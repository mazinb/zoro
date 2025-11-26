import { useState } from "react";

export default function EstatePlanner() {
  const [theme, setTheme] = useState("light");

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: theme === 'light' ? '#fafafa' : '#111',
      color: theme === 'light' ? '#111' : '#eee',
      fontFamily: '-apple-system, Inter, sans-serif',
      padding: '20px',
      transition: 'all 0.3s'
    }}>
      <button 
        onClick={toggleTheme}
        style={{
          position: 'fixed',
          top: '14px',
          right: '14px',
          background: 'transparent',
          border: 'none',
          fontSize: '26px',
          cursor: 'pointer',
          color: 'inherit'
        }}
      >
        {theme === "light" ? "☾" : "☼"}
      </button>

      <h1 style={{
        textAlign: 'center',
        fontSize: '22px',
        fontWeight: '600',
        marginBottom: '30px'
      }}>
        Financial Profile & Estate Planner
      </h1>

      {/* Profile Section */}
      <div style={{
        maxWidth: '700px',
        margin: '20px auto',
        padding: '20px',
        background: theme === 'light' ? '#fff' : '#1b1b1b',
        border: `1px solid ${theme === 'light' ? '#ccc' : '#333'}`,
        borderRadius: '8px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px' }}>Profile</h2>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Full Name</span>
            <input style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Date of Birth</span>
            <input type="date" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Email</span>
            <input type="email" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Phone</span>
            <input style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Address</span>
            <textarea style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit',
              minHeight: '80px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }} />
          </label>
        </div>
      </div>

      {/* Income Section */}
      <div style={{
        maxWidth: '700px',
        margin: '20px auto',
        padding: '20px',
        background: theme === 'light' ? '#fff' : '#1b1b1b',
        border: `1px solid ${theme === 'light' ? '#ccc' : '#333'}`,
        borderRadius: '8px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px' }}>Income</h2>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Primary Income (Annual)</span>
            <input type="number" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Other Income (Annual)</span>
            <input type="number" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Income Notes</span>
            <textarea style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit',
              minHeight: '80px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }} />
          </label>
        </div>
      </div>

      {/* Assets Section */}
      <div style={{
        maxWidth: '700px',
        margin: '20px auto',
        padding: '20px',
        background: theme === 'light' ? '#fff' : '#1b1b1b',
        border: `1px solid ${theme === 'light' ? '#ccc' : '#333'}`,
        borderRadius: '8px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px' }}>Assets</h2>
        <h3 style={{ fontSize: '16px', fontWeight: '500', marginTop: '15px' }}>Property</h3>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Home Value</span>
            <input type="number" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Other Property Value</span>
            <input type="number" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>

        <h3 style={{ fontSize: '16px', fontWeight: '500', marginTop: '15px' }}>Investments</h3>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Equity / Mutual Funds</span>
            <input type="number" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Fixed Income</span>
            <input type="number" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Crypto</span>
            <input type="number" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Cash & Bank</span>
            <input type="number" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>

        <h3 style={{ fontSize: '16px', fontWeight: '500', marginTop: '15px' }}>Other Assets</h3>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Vehicles, valuables, collectibles</span>
            <textarea style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit',
              minHeight: '80px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }} />
          </label>
        </div>
      </div>

      {/* Liabilities Section */}
      <div style={{
        maxWidth: '700px',
        margin: '20px auto',
        padding: '20px',
        background: theme === 'light' ? '#fff' : '#1b1b1b',
        border: `1px solid ${theme === 'light' ? '#ccc' : '#333'}`,
        borderRadius: '8px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px' }}>Liabilities</h2>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Home Loan</span>
            <input type="number" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Personal Loan</span>
            <input type="number" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Credit Card Dues</span>
            <input type="number" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Business / Other Commitments</span>
            <input type="number" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
      </div>

      {/* Insurance & Pensions Section */}
      <div style={{
        maxWidth: '700px',
        margin: '20px auto',
        padding: '20px',
        background: theme === 'light' ? '#fff' : '#1b1b1b',
        border: `1px solid ${theme === 'light' ? '#ccc' : '#333'}`,
        borderRadius: '8px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px' }}>Insurance & Pensions</h2>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Life Insurance Cover</span>
            <input type="number" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Health Insurance Cover</span>
            <input type="number" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Pension / NPS / 401k Value</span>
            <input type="number" style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Nominee Details</span>
            <textarea style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit',
              minHeight: '80px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }} />
          </label>
        </div>
      </div>

      {/* Estate Section */}
      <div style={{
        maxWidth: '700px',
        margin: '20px auto',
        padding: '20px',
        background: theme === 'light' ? '#fff' : '#1b1b1b',
        border: `1px solid ${theme === 'light' ? '#ccc' : '#333'}`,
        borderRadius: '8px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px' }}>Estate</h2>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Primary Beneficiaries</span>
            <textarea style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit',
              minHeight: '80px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Guardianship Wishes (if children)</span>
            <textarea style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit',
              minHeight: '80px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Asset Distribution Instructions</span>
            <textarea style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit',
              minHeight: '80px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }} />
          </label>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', marginBottom: '4px' }}>Funeral / Organ Donation Preferences</span>
            <textarea style={{
              padding: '10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
              background: 'transparent',
              color: 'inherit',
              minHeight: '80px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }} />
          </label>
        </div>
      </div>

      {/* Private Messages Section */}
      <div style={{
        maxWidth: '700px',
        margin: '20px auto',
        padding: '20px',
        background: theme === 'light' ? '#fff' : '#1b1b1b',
        border: `1px solid ${theme === 'light' ? '#ccc' : '#333'}`,
        borderRadius: '8px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px' }}>Private Messages</h2>
        <p style={{ fontSize: '13px', opacity: '0.7', marginBottom: '10px' }}>
          Upload private voice or video messages for your family.
        </p>
        <input type="file" accept="audio/*,video/*" style={{
          padding: '8px',
          fontSize: '14px',
          borderRadius: '6px',
          border: `1px solid ${theme === 'light' ? '#ccc' : '#444'}`,
          background: 'transparent',
          color: 'inherit'
        }} />
      </div>

      <div style={{ height: '100px' }}></div>
    </div>
  );
}