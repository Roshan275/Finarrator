const admin = require('../config/AdminFirebase');
const { db } = require('../config/AdminFirebase');

const storeFiMcpData = async (userId, fullData, callback) => {
  try {
    const mfTransactions = fullData.fetch_mf_transactions?.mfTransactions;
    const stockTransactions = fullData.fetch_stock_transactions?.stockTransactions;
    const bankTransactions = fullData.fetch_bank_transactions?.bankTransactions;
    const creditReports = fullData.fetch_credit_report?.creditReports;
    const epfDetails = fullData.fetch_epf_details?.uanAccounts;

    const userRef = db.collection("fiMcpData").doc(userId);

    // 🔁 Mutual Funds
    if (mfTransactions) {
      const mfRef = userRef.collection("mfTransactions");
      for (const mf of mfTransactions) {
        const formattedTxns = mf.txns.map(
          ([orderType, transactionDate, purchasePrice, purchaseUnits, transactionAmount]) => ({
            orderType,
            transactionDate,
            purchasePrice,
            purchaseUnits,
            transactionAmount,
          })
        );

        await mfRef.doc(mf.isin).set({
          ...mf,
          txns: formattedTxns,
        });

        console.log("📥 Written MF:", mf.isin);
      }
    }

    // 🔁 Stock Transactions
    if (stockTransactions) {
      const stockRef = userRef.collection("stockTransactions");
      for (const stock of stockTransactions) {
        const formattedTxns = stock.txns.map(([transactionType, transactionDate, quantity, navValue]) => ({
          transactionType,
          transactionDate,
          quantity,
          navValue: navValue ?? null,
        }));

        await stockRef.doc(stock.isin).set({
          ...stock,
          txns: formattedTxns,
        });

        console.log("📥 Written Stock:", stock.isin);
      }
    }

    // 🔁 Bank Transactions
    if (bankTransactions) {
      const bankRef = userRef.collection("bankTransactions");

      const typeMap = {
        1: "CREDIT",
        2: "DEBIT",
        3: "OPENING",
        4: "INTEREST",
        5: "TDS",
        6: "INSTALLMENT",
        7: "CLOSING",
        8: "OTHERS",
      };

      for (const bank of bankTransactions) {
        const formattedTxns = bank.txns.map(
          ([transactionAmount, transactionNarration, transactionDate, transactionType, transactionMode, currentBalance]) => ({
            transactionAmount,
            transactionNarration,
            transactionDate,
            transactionType: typeMap[transactionType] || "UNKNOWN",
            transactionMode,
            currentBalance,
          })
        );

        await bankRef.doc(bank.bank).set({
          ...bank,
          txns: formattedTxns,
        });

        console.log("📥 Written Bank:", bank.bank);
      }
    }

    // 🔁 Credit Reports
    if (creditReports) {
      const creditRef = userRef.collection("creditReports");
      for (let i = 0; i < creditReports.length; i++) {
        await creditRef.doc(`report_${i}`).set(creditReports[i]);
        console.log(`📥 Written Credit Report ${i}`);
      }
    }

    // 🔁 EPF Details
    if (epfDetails) {
      const epfRef = userRef.collection("epfDetails");
      for (let i = 0; i < epfDetails.length; i++) {
        await epfRef.doc(`account_${i}`).set(epfDetails[i]);
        console.log(`📥 Written EPF Account ${i}`);
      }
    }

    console.log("✅ All Fi-MCP data uploaded under user:", userId);

    // ✅ Call callback only if it's a function
    if (typeof callback === "function") callback();

  } catch (error) {
    console.error("❌ Error in storeFiMcpData:", error.message);
  }
};

module.exports = storeFiMcpData;
