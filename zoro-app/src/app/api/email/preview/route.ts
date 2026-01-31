import { NextRequest, NextResponse } from 'next/server';
import { buildDraftResponseEmail } from '@/lib/email-drafting';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Get test parameters or use defaults
    const userName = searchParams.get('name') || 'Test User';
    const goals = searchParams.get('goals')?.split(',') || ['save', 'invest', 'retirement'];
    const userToken = searchParams.get('token') || 'test-token-12345';
    const waitlistPosition = searchParams.get('waitlist') || '42';

    const testBody = {
      name: userName,
      goals: goals,
      userToken: userToken,
      waitlistPosition: waitlistPosition,
    };

    const email = await buildDraftResponseEmail(testBody);

    // Return HTML preview
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Email Preview</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .preview-container {
              background: white;
              padding: 40px;
              border: 1px solid #ddd;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .controls {
              background: #f9f9f9;
              padding: 20px;
              margin-bottom: 20px;
              border-radius: 8px;
              border: 1px solid #ddd;
            }
            .controls label {
              display: block;
              margin-bottom: 10px;
            }
            .controls input {
              width: 100%;
              padding: 8px;
              margin-bottom: 10px;
              border: 1px solid #ddd;
              border-radius: 4px;
            }
            .email-content {
              border: 1px solid #ddd;
              padding: 20px;
              background: white;
              color: #000000;
            }
            .email-content p,
            .email-content ul,
            .email-content li {
              color: #000000;
            }
            h1 {
              margin-top: 0;
            }
            .text-version {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #ddd;
            }
            pre {
              background: #f5f5f5;
              padding: 15px;
              border-radius: 4px;
              overflow-x: auto;
              white-space: pre-wrap;
            }
          </style>
        </head>
        <body>
          <div class="preview-container">
            <h1>Email Preview</h1>
            
            <div class="controls">
              <form method="GET">
                <label>
                  Name:
                  <input type="text" name="name" value="${escapeHtml(userName)}" />
                </label>
                <label>
                  Goals (comma-separated: save, invest, home, insurance, tax, retirement):
                  <input type="text" name="goals" value="${escapeHtml(goals.join(','))}" />
                </label>
                <label>
                  User Token:
                  <input type="text" name="token" value="${escapeHtml(userToken)}" />
                </label>
                <label>
                  Waitlist Position (leave empty for none):
                  <input type="text" name="waitlist" value="${escapeHtml(waitlistPosition)}" />
                </label>
                <button type="submit" style="padding: 10px 20px; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer;">
                  Update Preview
                </button>
              </form>
            </div>

            <h2>HTML Version:</h2>
            <div class="email-content">
              ${email.html}
            </div>

            <div class="text-version">
              <h2>Plain Text Version:</h2>
              <pre>${email.text}</pre>
            </div>
          </div>
        </body>
      </html>
      `,
      {
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  } catch (error) {
    console.error('Email preview error:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

