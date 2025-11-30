/**
 * SEBI Investment Adviser Import Script
 * 
 * This script imports investment advisors from the SEBI website into Supabase.
 * It uses Puppeteer to handle JavaScript-based pagination on the SEBI site.
 * 
 * Usage:
 *   npm run import-advisors              # Import all advisors
 *   npm run import-advisors:pages 5      # Import first 5 pages only
 *   npm run import-advisors:resume       # Resume from last saved progress
 * 
 * Requirements:
 *   - NEXT_PUBLIC_SUPABASE_URL in .env
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY in .env
 *   - RLS policies must allow INSERT and UPDATE on advisors table
 * 
 * Progress is saved to tmp-import-progress/ after each page.
 */

const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envLocalPath = path.join(__dirname, '../.env.local');
const envPath = path.join(__dirname, '../.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Missing Supabase environment variables.');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const SEBI_URL = 'https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes&intmId=13';

// Progress tracking paths
const PROGRESS_DIR = path.join(__dirname, '../tmp-import-progress');
const PROGRESS_FILE = path.join(PROGRESS_DIR, 'advisors-progress.json');
const LOG_FILE = path.join(PROGRESS_DIR, 'import-log.txt');

// Ensure progress directory exists
if (!fs.existsSync(PROGRESS_DIR)) {
  fs.mkdirSync(PROGRESS_DIR, { recursive: true });
}

// Logging function (writes to both console and file)
function log(message, toFile = true) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(message);
  if (toFile) {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  }
}

// Save progress to file after each page
function saveProgress(advisors, pageNum, totalRecords) {
  const progress = {
    lastPage: pageNum,
    totalRecords: totalRecords,
    advisorsCount: advisors.size,
    advisors: Array.from(advisors.entries()).map(([regNo, advisor]) => ({
      registrationNo: regNo,
      ...advisor
    })),
    lastUpdated: new Date().toISOString()
  };
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  log(`Progress saved: ${advisors.size} advisors from ${pageNum} pages`);
}

// Load progress from file (for resume functionality)
function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      log(`Error loading progress: ${error.message}`, false);
      return null;
    }
  }
  return null;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract advisor data from page using Puppeteer
async function extractAdvisorsFromPage(page) {
  await page.waitForSelector('.fixed-table-body.card-table', { timeout: 10000 });
  
  const advisors = await page.evaluate(() => {
    const cards = document.querySelectorAll('.fixed-table-body.card-table');
    const advisors = [];
    
    cards.forEach(card => {
      const advisor = {
        name: '',
        registrationNo: '',
        email: null,
        telephone: null,
        fax: null,
        address: null,
        contactPerson: null,
        correspondenceAddress: null,
        validity: null
      };

      const cardViews = card.querySelectorAll('.card-view');
      
      cardViews.forEach(cardView => {
        const titleElem = cardView.querySelector('.title span');
        const valueElem = cardView.querySelector('.value span');
        
        if (!titleElem || !valueElem) return;
        
        const title = titleElem.textContent.trim();
        const value = valueElem.textContent.trim();

        switch (title.toLowerCase()) {
          case 'name':
            advisor.name = value;
            break;
          case 'registration no.':
            advisor.registrationNo = value;
            break;
          case 'e-mail':
          case 'email':
            advisor.email = value || null;
            break;
          case 'telephone':
            advisor.telephone = value || null;
            break;
          case 'fax no.':
          case 'fax':
            advisor.fax = value || null;
            break;
          case 'address':
            advisor.address = value || null;
            break;
          case 'contact person':
            advisor.contactPerson = value || null;
            break;
          case 'correspondence address':
            advisor.correspondenceAddress = value || null;
            break;
          case 'validity':
            advisor.validity = value || null;
            break;
        }
      });

      if (advisor.name && advisor.registrationNo) {
        advisors.push(advisor);
      }
    });
    
    return advisors;
  });

  return advisors;
}

// Get total records count from pagination info
async function getTotalRecords(page) {
  try {
    const totalText = await page.evaluate(() => {
      const paginationText = document.querySelector('.pagination_inner p');
      return paginationText ? paginationText.textContent : null;
    });

    if (totalText) {
      const match = totalText.match(/(\d+)\s+to\s+(\d+)\s+of\s+(\d+)\s+records/);
      if (match) {
        return parseInt(match[3]);
      }
    }
  } catch (error) {
    console.error('Error getting total records:', error.message);
  }
  return null;
}

// Navigate to next page using JavaScript pagination
async function goToNextPage(page, pageNum) {
  try {
    const nextValue = pageNum - 1; // page 2 = nextValue 1, page 3 = nextValue 2, etc.
    
    // Get first advisor's registration number to detect when page changes
    const firstRegistrationBefore = await page.evaluate(() => {
      const firstCard = document.querySelector('.fixed-table-body.card-table');
      if (firstCard) {
        const regNoElem = firstCard.querySelector('.card-view .value span');
        return regNoElem ? regNoElem.textContent.trim() : null;
      }
      return null;
    });

    await page.waitForSelector('form[name="otherForm"]', { timeout: 5000 });
    
    // Set the nextValue in the hidden input
    await page.evaluate((value) => {
      const form = document.querySelector('form[name="otherForm"]');
      if (form) {
        let nextValueInput = form.querySelector('input[name="nextValue"]');
        if (!nextValueInput) {
          nextValueInput = document.createElement('input');
          nextValueInput.type = 'hidden';
          nextValueInput.name = 'nextValue';
          form.appendChild(nextValueInput);
        }
        nextValueInput.value = value;
      }
    }, nextValue.toString());
    
    // Execute the searchFormFpi function to navigate
    await page.evaluate((value) => {
      if (typeof window.searchFormFpi === 'function') {
        window.searchFormFpi('n', value);
      } else {
        const form = document.querySelector('form[name="otherForm"]');
        if (form) {
          form.submit();
        }
      }
    }, nextValue.toString());
    
    // Wait for content to change (AJAX update, not full page navigation)
    try {
      await page.waitForFunction(
        (firstRegBefore) => {
          const firstCard = document.querySelector('.fixed-table-body.card-table');
          if (!firstCard) return false;
          const regNoElem = firstCard.querySelector('.card-view .value span');
          const currentReg = regNoElem ? regNoElem.textContent.trim() : null;
          return currentReg && currentReg !== firstRegBefore;
        },
        { timeout: 30000 },
        firstRegistrationBefore
      );
    } catch (error) {
      // Fallback: just wait for the selector
      await page.waitForSelector('.fixed-table-body.card-table', { timeout: 10000 });
      await delay(2000);
    }
    
    await delay(1000);
    return true;
  } catch (error) {
    console.error(`Error navigating to page ${pageNum + 1}:`, error.message);
    return false;
  }
}

// Fetch all advisors from SEBI website using Puppeteer
async function fetchAdvisorsFromSEBI(maxPages = null, resume = false) {
  log('='.repeat(60));
  log('Starting SEBI advisor fetch...');
  log('='.repeat(60));
  
  // Check for existing progress
  let savedProgress = null;
  let startPage = 1;
  const allAdvisors = new Map();
  
  if (resume) {
    savedProgress = loadProgress();
    if (savedProgress) {
      log(`Resuming from page ${savedProgress.lastPage + 1}...`);
      log(`Already have ${savedProgress.advisorsCount} advisors from previous run`);
      startPage = savedProgress.lastPage + 1;
      savedProgress.advisors.forEach(advisor => {
        allAdvisors.set(advisor.registrationNo, advisor);
      });
    }
  }
  
  log('Launching browser with Puppeteer...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    log('Navigating to SEBI website...');
    await page.goto(SEBI_URL, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    log('Waiting for page to load...');
    await page.waitForSelector('.fixed-table-body.card-table', { timeout: 10000 });

    const totalRecords = await getTotalRecords(page);
    const finalTotalRecords = savedProgress?.totalRecords || totalRecords;
    if (finalTotalRecords) {
      log(`Total records: ${finalTotalRecords}`);
    }

    let pageNum = startPage;
    let consecutiveEmptyPages = 0;
    const maxEmptyPages = 3;
    
    // Navigate to starting page if resuming
    if (resume && startPage > 1) {
      log(`Navigating to page ${startPage}...`);
      for (let i = 1; i < startPage; i++) {
        const navigated = await goToNextPage(page, i);
        if (!navigated) {
          log(`Could not navigate to page ${startPage}, starting from page 1`);
          pageNum = 1;
          break;
        }
      }
    }

    while (consecutiveEmptyPages < maxEmptyPages) {
      log(`\n--- Page ${pageNum} ---`);
      log(`Extracting advisors from page ${pageNum}...`);
      
      const advisors = await extractAdvisorsFromPage(page);
      
      if (advisors.length === 0) {
        consecutiveEmptyPages++;
        log(`  ⚠️  No advisors found on page ${pageNum}`);
        if (consecutiveEmptyPages >= maxEmptyPages) {
          log(`  Stopping: ${maxEmptyPages} consecutive empty pages`);
          break;
        }
      } else {
        consecutiveEmptyPages = 0;
        const sizeBefore = allAdvisors.size;
        
        advisors.forEach(advisor => {
          if (advisor.registrationNo) {
            allAdvisors.set(advisor.registrationNo, advisor);
          }
        });
        
        const newAdvisors = allAdvisors.size - sizeBefore;
        log(`  ✓ Found ${advisors.length} advisors (${newAdvisors} new, ${allAdvisors.size} total unique)`);
        
        // Save progress after each page
        saveProgress(allAdvisors, pageNum, finalTotalRecords);
      }

      // Check if we've collected all records
      if (finalTotalRecords && allAdvisors.size >= finalTotalRecords) {
        log(`  ✓ Reached total records (${finalTotalRecords})`);
        break;
      }
      
      // Check max pages limit
      if (maxPages && pageNum >= maxPages) {
        log(`  ✓ Reached max pages limit (${maxPages})`);
        break;
      }

      // Try to go to next page
      log(`  Attempting to navigate to page ${pageNum + 1}...`);
      const hasNext = await goToNextPage(page, pageNum);
      
      if (!hasNext) {
        log(`  ⚠️  Could not navigate to next page`);
        break;
      }

      pageNum++;
      
      // Safety limit
      if (pageNum > 45) {
        log(`  ⚠️  Reached safety limit of 45 pages`);
        break;
      }
    }

    log(`\n✓ Fetch complete: Found ${allAdvisors.size} unique advisors from ${pageNum} pages`);
    saveProgress(allAdvisors, pageNum, finalTotalRecords);

    return Array.from(allAdvisors.values());

  } catch (error) {
    log(`Error fetching advisors: ${error.message}`);
    throw error;
  } finally {
    await browser.close();
  }
}

// Main import function
async function importAdvisors(maxPages = null, resume = false) {
  // Clear log file on new run (unless resuming)
  if (!resume || !fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '');
  }
  
  log('='.repeat(60));
  log('SEBI Investment Adviser Import Script (Puppeteer)');
  log('='.repeat(60));
  if (maxPages) {
    log(`Limiting to ${maxPages} pages`);
  }
  if (resume) {
    log('Resuming from previous progress');
  }
  log('');

  let totalImported = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  try {
    const advisors = await fetchAdvisorsFromSEBI(maxPages, resume);
    
    if (advisors.length === 0) {
      log('⚠️  No advisors found. Please check:');
      log('   1. The website structure may have changed');
      log('   2. Check tmp-import-progress/ for the HTML structure');
      log('   3. Network connectivity issues');
      return;
    }

    log(`\nProcessing ${advisors.length} unique advisors for database import...`);
    
    if (advisors.length === 0) {
      log('⚠️  No advisors to import.');
      return;
    }

    let processed = 0;
    log('Starting database import...\n');
    
    for (const advisor of advisors) {
      try {
        const advisorData = {
          registration_no: advisor.registrationNo,
          name: advisor.name,
          email: advisor.email || null,
          telephone: advisor.telephone || null,
          fax: advisor.fax || null,
          address: advisor.address || null,
          contact_person: advisor.contactPerson || null,
          correspondence_address: advisor.correspondenceAddress || null,
          validity: advisor.validity || null,
          updated_at: new Date().toISOString()
        };

        // Check if advisor exists
        const { data: existing } = await supabase
          .from('advisors')
          .select('id')
          .eq('registration_no', advisor.registrationNo)
          .maybeSingle();

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from('advisors')
            .update(advisorData)
            .eq('registration_no', advisor.registrationNo);

          if (error) {
            log(`✗ Error updating ${advisor.registrationNo}: ${error.message}`);
            totalErrors++;
          } else {
            totalUpdated++;
            processed++;
            if (processed % 50 === 0 || processed === advisors.length) {
              const msg = `  Processed: ${processed}/${advisors.length} (${totalImported} new, ${totalUpdated} updated)`;
              process.stdout.write(`\r${msg}`);
              log(msg, false);
            }
          }
        } else {
          // Insert new
          const { error } = await supabase
            .from('advisors')
            .insert(advisorData);

          if (error) {
            log(`✗ Error inserting ${advisor.registrationNo}: ${error.message}`);
            totalErrors++;
          } else {
            totalImported++;
            processed++;
            if (processed % 50 === 0 || processed === advisors.length) {
              const msg = `  Processed: ${processed}/${advisors.length} (${totalImported} new, ${totalUpdated} updated)`;
              process.stdout.write(`\r${msg}`);
              log(msg, false);
            }
          }
        }

        await delay(50);

      } catch (error) {
        log(`✗ Error processing ${advisor.registrationNo}: ${error.message}`);
        totalErrors++;
      }
    }

    if (processed > 0) {
      log(`\n✓ Database import complete: ${processed}/${advisors.length} processed`);
    } else {
      log('⚠️  No advisors were processed. Check for errors above.');
    }

  } catch (error) {
    log(`\n✗ Fatal error: ${error.message}`);
    throw error;
  }

  log('\n' + '='.repeat(60));
  log('Import Summary:');
  log('='.repeat(60));
  log(`  ✓ Imported: ${totalImported}`);
  log(`  ✓ Updated:  ${totalUpdated}`);
  log(`  ✗ Errors:   ${totalErrors}`);
  log(`  Total:     ${totalImported + totalUpdated}`);
  log('='.repeat(60));
  log(`\nLog file: ${LOG_FILE}`);
  log(`Progress file: ${PROGRESS_FILE}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
let maxPages = null;
let resume = false;

args.forEach(arg => {
  if (arg.startsWith('--max-pages=')) {
    maxPages = parseInt(arg.split('=')[1]);
  } else if (arg === '--resume') {
    resume = true;
  }
});

// Run the import
importAdvisors(maxPages, resume).catch(error => {
  log(`\n✗ Fatal error: ${error.message}`);
  console.error('\nFatal error:', error);
  process.exit(1);
});
