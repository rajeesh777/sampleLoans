import React, { useRef } from 'react';
import { Download, Upload, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';

export default function ExportBackup({ state, onImportState, onResetState }) {
  const fileInputRef = useRef(null);

  // Export state to JSON file
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `isthooi_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export full 52-week ledger to CSV
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Week_Number,Date,Member_Name,Regular_Amount,Regular_Paid_Status,Payment_Method,Paid_At\n";

    for (let w = 1; w <= 52; w++) {
      const wData = state.weeks[w];
      if (wData && wData.collections) {
        state.members.forEach((m) => {
          const rec = wData.collections[m.id] || {};
          const row = [
            w,
            wData.date,
            `"${m.name}"`,
            rec.amount || 1000,
            rec.paid ? 'PAID' : 'UNPAID',
            rec.paymentMethod || 'UPI',
            rec.paidAt || ''
          ].join(',');
          csvContent += row + "\n";
        });
      }
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sunday_fund_52week_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Import JSON file
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const importedData = JSON.parse(evt.target.result);
        if (importedData && importedData.members && importedData.weeks) {
          onImportState(importedData);
          alert('Data backup successfully restored!');
        } else {
          alert('Invalid backup file format.');
        }
      } catch (err) {
        alert('Error parsing JSON backup file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="backup-container">
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <Download size={20} color="#10b981" /> Backup, Restore & Data Export
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {/* JSON Backup */}
          <div style={{ background: 'var(--bg-dark)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '8px', color: '#10b981' }}>
              Download JSON Backup
            </h4>
            <p style={{ fontSize: '0.825rem', color: '#94a3b8', marginBottom: '16px' }}>
              Save a full backup of all 52 weeks, member profiles, and active loan records to your device.
            </p>
            <button className="btn btn-primary" onClick={handleExportJSON} style={{ width: '100%' }}>
              <Download size={18} /> Download JSON Backup
            </button>
          </div>

          {/* CSV Export */}
          <div style={{ background: 'var(--bg-dark)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '8px', color: '#f59e0b' }}>
              Export CSV Spreadsheet
            </h4>
            <p style={{ fontSize: '0.825rem', color: '#94a3b8', marginBottom: '16px' }}>
              Export 52-week contribution records to CSV format for Excel or Google Sheets.
            </p>
            <button className="btn btn-gold" onClick={handleExportCSV} style={{ width: '100%' }}>
              <FileText size={18} /> Export CSV Spreadsheet
            </button>
          </div>

          {/* Restore JSON */}
          <div style={{ background: 'var(--bg-dark)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '8px', color: '#6366f1' }}>
              Restore from Backup
            </h4>
            <p style={{ fontSize: '0.825rem', color: '#94a3b8', marginBottom: '16px' }}>
              Load previously exported JSON backup file to restore application state.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              style={{ display: 'none' }}
            />
            <button
              className="btn btn-secondary"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              style={{ width: '100%' }}
            >
              <Upload size={18} /> Upload JSON Backup
            </button>
          </div>

          {/* Reset Demo Data */}
          <div style={{ background: 'var(--bg-dark)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '8px', color: '#f43f5e' }}>
              Reset Application Data
            </h4>
            <p style={{ fontSize: '0.825rem', color: '#94a3b8', marginBottom: '16px' }}>
              Reset all weeks and reload fresh sample data with demo members.
            </p>
            <button
              className="btn btn-rose"
              onClick={() => {
                if (window.confirm('Are you sure you want to reset all data? This will reset all payments.')) {
                  onResetState();
                }
              }}
              style={{ width: '100%' }}
            >
              <RefreshCw size={18} /> Reset App State
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
