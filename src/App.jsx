import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import SundayLedger from './components/SundayLedger';
import SundayContributions from './components/SundayContributions';
import LoanCollections from './components/LoanCollections';
import LoanManager from './components/LoanManager';
import DefaultersWatchdog from './components/DefaultersWatchdog';
import AnnualSettlement from './components/AnnualSettlement';
import MemberRoster from './components/MemberRoster';
import ExportBackup from './components/ExportBackup';
import Settings from './components/Settings';

import {
  loadState,
  saveState,
  getGroupStats,
  getInitialState,
  generate52Sundays
} from './utils/storage';

export default function App() {
  const [state, setState] = useState(() => loadState());
  const [activeTab, setActiveTab] = useState('dashboard');

  // Sync state changes to localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  const groupStats = getGroupStats(state);

  // Toggle regular Sunday contribution payment
  const handleTogglePayment = (weekNum, memberId) => {
    setState((prevState) => {
      const nextWeeks = { ...prevState.weeks };
      const currentWeekData = nextWeeks[weekNum] || { collections: {} };
      const memberColl = currentWeekData.collections[memberId] || { paid: false, amount: 1000 };

      const newPaid = !memberColl.paid;

      nextWeeks[weekNum] = {
        ...currentWeekData,
        collections: {
          ...currentWeekData.collections,
          [memberId]: {
            ...memberColl,
            paid: newPaid,
            paidAt: newPaid ? new Date().toISOString().slice(0, 10) : null
          }
        }
      };

      return {
        ...prevState,
        weeks: nextWeeks
      };
    });
  };

  // Toggle loan installment payment for a member on a specific Sunday
  const handleToggleLoanInstallment = (weekNum, memberId, loanId) => {
    setState((prevState) => {
      const nextWeeks = { ...prevState.weeks };
      const currentWeekData = nextWeeks[weekNum] || { collections: {} };
      const memberColl = currentWeekData.collections[memberId] || {};

      const currentLoanPaid = memberColl.loanInstallmentPaid || false;
      const newLoanPaid = !currentLoanPaid;

      // Find loan
      const targetLoan = prevState.loans.find((l) => l.id === loanId);
      const installmentAmt = targetLoan ? targetLoan.weeklyInstallment : 1000;

      // Update loan repaidAmount
      const nextLoans = prevState.loans.map((loan) => {
        if (loan.id === loanId) {
          const delta = newLoanPaid ? installmentAmt : -installmentAmt;
          const newRepaid = Math.max(0, loan.repaidAmount + delta);
          const isFullyRepaid = newRepaid >= loan.requestedAmount;
          return {
            ...loan,
            repaidAmount: newRepaid,
            isFullyRepaid,
            status: isFullyRepaid ? 'REPAID' : 'ACTIVE'
          };
        }
        return loan;
      });

      nextWeeks[weekNum] = {
        ...currentWeekData,
        collections: {
          ...currentWeekData.collections,
          [memberId]: {
            ...memberColl,
            loanInstallmentPaid: newLoanPaid,
            loanInstallmentAmount: newLoanPaid ? installmentAmt : 0
          }
        }
      };

      return {
        ...prevState,
        weeks: nextWeeks,
        loans: nextLoans
      };
    });
  };

  // Bulk action: Mark all 10 members paid for selected Sunday
  const handleMarkAllPaid = (weekNum) => {
    setState((prevState) => {
      const nextWeeks = { ...prevState.weeks };
      const weekData = nextWeeks[weekNum] || { collections: {} };
      const updatedCollections = { ...weekData.collections };

      prevState.members.forEach((m) => {
        updatedCollections[m.id] = {
          ...(updatedCollections[m.id] || {}),
          paid: true,
          amount: 1000,
          paidAt: new Date().toISOString().slice(0, 10)
        };
      });

      nextWeeks[weekNum] = {
        ...weekData,
        collections: updatedCollections
      };

      return {
        ...prevState,
        weeks: nextWeeks
      };
    });
  };

  // Change payment method (UPI, Cash, Bank)
  const handleChangePaymentMethod = (weekNum, memberId, method) => {
    setState((prevState) => {
      const nextWeeks = { ...prevState.weeks };
      const weekData = nextWeeks[weekNum] || { collections: {} };
      const memberColl = weekData.collections[memberId] || {};

      nextWeeks[weekNum] = {
        ...weekData,
        collections: {
          ...weekData.collections,
          [memberId]: {
            ...memberColl,
            paymentMethod: method
          }
        }
      };

      return {
        ...prevState,
        weeks: nextWeeks
      };
    });
  };

  // Advance payment for Sunday contributions (custom amount distributed across weeks)
  const handleAdvancePayment = (startWeek, memberId, totalAmount, method = 'UPI') => {
    setState((prevState) => {
      const nextWeeks = { ...prevState.weeks };
      const weeklyAmount = prevState.weeklyAmount || 1000;
      let remainingAmount = totalAmount;
      let currentWeek = startWeek;

      while (remainingAmount > 0 && currentWeek <= 52) {
        const weekData = nextWeeks[currentWeek] || { collections: {} };
        const memberColl = weekData.collections[memberId] || { paid: false, amount: weeklyAmount };
        const amountForThisWeek = Math.min(remainingAmount, weeklyAmount);

        nextWeeks[currentWeek] = {
          ...weekData,
          collections: {
            ...weekData.collections,
            [memberId]: {
              ...memberColl,
              paid: true,
              amount: amountForThisWeek,
              paidAt: new Date().toISOString().slice(0, 10),
              paymentMethod: method
            }
          }
        };

        remainingAmount -= amountForThisWeek;
        currentWeek++;
      }

      return {
        ...prevState,
        weeks: nextWeeks
      };
    });
  };

  // Advance payment for loan installments (custom amount distributed across weeks)
  const handleAdvanceLoanInstallment = (startWeek, memberId, loanId, totalAmount) => {
    setState((prevState) => {
      const nextWeeks = { ...prevState.weeks };
      const targetLoan = prevState.loans.find((l) => l.id === loanId);
      const installmentAmt = targetLoan ? targetLoan.weeklyInstallment : 1000;
      let remainingAmount = totalAmount;
      let currentWeek = startWeek;
      let totalAdvancePayment = 0;

      while (remainingAmount > 0 && currentWeek <= 52) {
        const weekData = nextWeeks[currentWeek] || { collections: {} };
        const memberColl = weekData.collections[memberId] || {};
        const amountForThisWeek = Math.min(remainingAmount, installmentAmt);

        nextWeeks[currentWeek] = {
          ...weekData,
          collections: {
            ...weekData.collections,
            [memberId]: {
              ...memberColl,
              loanInstallmentPaid: true,
              loanInstallmentAmount: amountForThisWeek
            }
          }
        };

        totalAdvancePayment += amountForThisWeek;
        remainingAmount -= amountForThisWeek;
        currentWeek++;
      }

      // Update loan repaidAmount
      const nextLoans = prevState.loans.map((loan) => {
        if (loan.id === loanId) {
          const newRepaid = Math.min(loan.requestedAmount, loan.repaidAmount + totalAdvancePayment);
          const isFullyRepaid = newRepaid >= loan.requestedAmount;
          return {
            ...loan,
            repaidAmount: newRepaid,
            isFullyRepaid,
            status: isFullyRepaid ? 'REPAID' : 'ACTIVE'
          };
        }
        return loan;
      });

      return {
        ...prevState,
        weeks: nextWeeks,
        loans: nextLoans
      };
    });
  };

  // Create new loan (10% upfront fee deduction)
  const handleCreateLoan = (loanData) => {
    const newLoan = {
      id: `loan-${Date.now()}`,
      memberId: loanData.memberId,
      nickname: loanData.nickname || 'General Advance',
      requestedAmount: loanData.requestedAmount,
      disbursedAmount: loanData.disbursedAmount,
      upfrontFee: loanData.upfrontFee,
      startWeekNum: loanData.startWeekNum,
      termWeeks: loanData.termWeeks || 10,
      weeklyInstallment: loanData.weeklyInstallment,
      repaidAmount: 0,
      status: 'ACTIVE',
      createdAt: new Date().toISOString().slice(0, 10)
    };

    setState((prevState) => ({
      ...prevState,
      loans: [newLoan, ...prevState.loans]
    }));
  };

  // Record extra loan repayment installment
  const handleRepayLoanExtra = (loanId, amount) => {
    setState((prevState) => {
      const nextLoans = prevState.loans.map((loan) => {
        if (loan.id === loanId) {
          const newRepaid = Math.min(loan.requestedAmount, loan.repaidAmount + amount);
          const isFullyRepaid = newRepaid >= loan.requestedAmount;
          return {
            ...loan,
            repaidAmount: newRepaid,
            isFullyRepaid,
            status: isFullyRepaid ? 'REPAID' : 'ACTIVE'
          };
        }
        return loan;
      });

      return {
        ...prevState,
        loans: nextLoans
      };
    });
  };

  // Update member details
  const handleUpdateMember = (updatedMember) => {
    setState((prevState) => ({
      ...prevState,
      members: prevState.members.map((m) => (m.id === updatedMember.id ? updatedMember : m))
    }));
  };

  // Import JSON backup
  const handleImportState = (importedData) => {
    setState(importedData);
  };

  // Reset to initial demo state
  const handleResetState = () => {
    const fresh = getInitialState();
    setState(fresh);
  };

  // Cease a week (lock it from further edits)
  const handleCeaseWeek = (weekNum) => {
    setState((prevState) => ({
      ...prevState,
      weeks: {
        ...prevState.weeks,
        [weekNum]: {
          ...prevState.weeks[weekNum],
          ceased: true,
          ceaseDate: new Date().toISOString().slice(0, 10)
        }
      }
    }));
  };

  // Update settings and regenerate weeks if needed
  const handleUpdateSettings = (settings) => {
    setState((prevState) => {
      const sundays = generate52Sundays(settings.startDate);
      let newWeeks = {};

      // Generate weeks based on totalWeeks setting
      for (let i = 0; i < settings.totalWeeks; i++) {
        const sunday = sundays[i % sundays.length];
        const weekNum = i + 1;
        const weekDate = new Date(settings.startDate);
        weekDate.setDate(weekDate.getDate() + (i * 7));
        const yyyy = weekDate.getFullYear();
        const mm = String(weekDate.getMonth() + 1).padStart(2, '0');
        const dd = String(weekDate.getDate()).padStart(2, '0');
        const dateFormatted = `${yyyy}-${mm}-${dd}`;

        // Preserve existing collections data if week exists
        const existingWeek = prevState.weeks[weekNum];
        const collections = existingWeek?.collections || {};

        prevState.members.forEach((m) => {
          if (!collections[m.id]) {
            collections[m.id] = {
              paid: false,
              amount: settings.weeklyAmount,
              paymentMethod: 'UPI',
              paidAt: null,
              loanInstallmentPaid: false,
              loanInstallmentAmount: 0
            };
          }
        });

        newWeeks[weekNum] = {
          weekNum: weekNum,
          date: dateFormatted,
          displayDate: weekDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }),
          collections,
          ceased: existingWeek?.ceased || false,
          ceaseDate: existingWeek?.ceaseDate || null
        };
      }

      return {
        ...prevState,
        startDate: settings.startDate,
        totalWeeks: settings.totalWeeks,
        groupName: settings.groupName,
        groupUpiVpa: settings.groupUpiVpa,
        weeklyAmount: settings.weeklyAmount,
        groupNotes: settings.groupNotes,
        weeks: newWeeks
      };
    });
  };

  // Toggle global edit lock
  const handleToggleEditLock = () => {
    setState((prevState) => ({
      ...prevState,
      editLocked: !prevState.editLocked
    }));
  };

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        groupStats={groupStats}
      />

      {/* Main Content Area */}
      <main className="content-area">
        {activeTab === 'dashboard' && (
          <Dashboard
            state={state}
            groupStats={groupStats}
            setActiveTab={setActiveTab}
            onTogglePayment={handleTogglePayment}
          />
        )}

        {activeTab === 'contributions' && (
          <SundayContributions
            state={state}
            editLocked={state.editLocked}
            onTogglePayment={handleTogglePayment}
            onMarkAllPaid={handleMarkAllPaid}
            onChangePaymentMethod={handleChangePaymentMethod}
            onAdvancePayment={handleAdvancePayment}
            onCeaseWeek={handleCeaseWeek}
          />
        )}

        {activeTab === 'loan-collections' && (
          <LoanCollections
            state={state}
            editLocked={state.editLocked}
            onToggleLoanInstallment={handleToggleLoanInstallment}
            onMarkAllPaid={handleMarkAllPaid}
            onAdvanceLoanInstallment={handleAdvanceLoanInstallment}
            onCeaseWeek={handleCeaseWeek}
          />
        )}

        {activeTab === 'ledger' && (
          <SundayLedger
            state={state}
            onTogglePayment={handleTogglePayment}
            onToggleLoanInstallment={handleToggleLoanInstallment}
            onMarkAllPaid={handleMarkAllPaid}
            onChangePaymentMethod={handleChangePaymentMethod}
            onAdvancePayment={handleAdvancePayment}
            onAdvanceLoanInstallment={handleAdvanceLoanInstallment}
            onCeaseWeek={handleCeaseWeek}
          />
        )}

        {activeTab === 'loans' && (
          <LoanManager
            state={state}
            groupStats={groupStats}
            onCreateLoan={handleCreateLoan}
            onRepayLoanExtra={handleRepayLoanExtra}
          />
        )}

        {activeTab === 'defaulters' && (
          <DefaultersWatchdog
            state={state}
          />
        )}

        {activeTab === 'settlement' && (
          <AnnualSettlement
            state={state}
            groupStats={groupStats}
          />
        )}

        {activeTab === 'members' && (
          <MemberRoster
            state={state}
            onUpdateMember={handleUpdateMember}
          />
        )}

        {activeTab === 'export' && (
          <ExportBackup
            state={state}
            onImportState={handleImportState}
            onResetState={handleResetState}
          />
        )}

        {activeTab === 'settings' && (
          <Settings
            state={state}
            onUpdateSettings={handleUpdateSettings}
            onCeaseWeek={handleCeaseWeek}
            onToggleEditLock={handleToggleEditLock}
          />
        )}
      </main>
    </div>
  );
}
