import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import SundayLedger from './components/SundayLedger';
import LoanManager from './components/LoanManager';
import DefaultersWatchdog from './components/DefaultersWatchdog';
import AnnualSettlement from './components/AnnualSettlement';
import MemberRoster from './components/MemberRoster';
import ExportBackup from './components/ExportBackup';

import {
  loadState,
  saveState,
  getGroupStats,
  getInitialState
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

        {activeTab === 'ledger' && (
          <SundayLedger
            state={state}
            onTogglePayment={handleTogglePayment}
            onToggleLoanInstallment={handleToggleLoanInstallment}
            onMarkAllPaid={handleMarkAllPaid}
            onChangePaymentMethod={handleChangePaymentMethod}
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
      </main>
    </div>
  );
}
