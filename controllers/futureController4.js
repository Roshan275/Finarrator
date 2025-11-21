const axios = require("axios");
const { db } = require("../config/AdminFirebase");
require("dotenv").config();

// Import hardcoded data files
const bankTransactions = require("../data/bankTransactions.json");
const creditReports = require("../data/creditReports.json");
const networth = require("../data/networth.json");

/**
 * Utility helpers
 */
function toNumber(v, fallback = 0) {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    const cleaned = v.replace(/[,\s]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function gaussianRandom(mean = 0, std = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * std + mean;
}

function quantile(sortedArr, q) {
  if (!Array.isArray(sortedArr) || sortedArr.length === 0) return null;
  const n = sortedArr.length;
  const pos = (n - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (base + 1 < n) {
    return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
  }
  return sortedArr[base];
}

function extractNumberFromQuery(query, possibleValues = []) {
  const numbers = query.match(/\d+/g);
  if (numbers && numbers.length > 0) {
    return parseInt(numbers[0]);
  }
  return possibleValues[Math.floor(Math.random() * possibleValues.length)];
}

/**
 * Get user data from hardcoded files
 */
const getAllUserData = async (userId) => {
  return {
    bankTransactions: bankTransactions,
    creditReports: creditReports,
    networth: networth,
    mfTransactions: [],
    stockTransactions: [],
    epfDetails: []
  };
};

/**
 * Calculate financial metrics from hardcoded data
 */
const calculateFinancialMetrics = (userData) => {
  const latestNetworth = userData.networth[userData.networth.length - 1] || {};
  const latestCredit = userData.creditReports[userData.creditReports.length - 1] || {};
  
  const salaryCredits = userData.bankTransactions.filter(
    t => t.description.toLowerCase().includes('salary') && t.type === 'credit'
  );
  const avgMonthlyIncome = salaryCredits.length > 0 
    ? salaryCredits.reduce((sum, t) => sum + t.amount, 0) / salaryCredits.length
    : 0;

  const expenses = userData.bankTransactions.filter(t => t.type === 'debit');
  const avgMonthlyExpenses = expenses.length > 0
    ? expenses.reduce((sum, t) => sum + t.amount, 0) / expenses.length
    : 0;

  return {
    monthlyIncome: avgMonthlyIncome,
    monthlyExpenses: avgMonthlyExpenses,
    savingsBalance: latestNetworth.assetBreakdown?.cashAndSavings || 0,
    investmentBalance: latestNetworth.assetBreakdown?.investmentAccounts || 0,
    retirementBalance: latestNetworth.assetBreakdown?.retirementAccounts || 0,
    totalDebt: latestCredit.totalDebt || 0,
    creditScore: latestCredit.creditScore || 0,
    monthlyDebtPayments: latestCredit.loanDetails?.reduce((sum, loan) => sum + (loan.monthlyPayment || 0), 0) || 0
  };
};

/**
 * Fallback default parameters when Gemini fails
 */
const getDefaultParameters = (scenario, financialMetrics, query) => {
  const { monthlyIncome, monthlyExpenses, savingsBalance, investmentBalance, totalDebt, monthlyDebtPayments } = financialMetrics;
  
  const defaults = {
    job_loss: {
      scenario: "job_loss",
      parameters: {
        monthlyIncomeBeforeLoss: monthlyIncome,
        incomeLossStartDate: new Date().toISOString().split('T')[0],
        jobSearchDurationMonths: extractNumberFromQuery(query, [3, 6, 9]),
        expectedNewIncomeAfterRecovery: monthlyIncome * 0.8,
        expenseEstimate: {
          monthlyFixedExpenses: monthlyExpenses * 0.6,
          monthlyVariableExpenses: monthlyExpenses * 0.4
        },
        savingsAndInvestments: {
          savingsAccountBalance: savingsBalance,
          epfBalance: 0,
          mutualFunds: investmentBalance * 0.5,
          securities: investmentBalance * 0.5
        },
        creditObligations: {
          totalOutstandingBalance: totalDebt,
          securedOutstanding: totalDebt * 0.7,
          unsecuredOutstanding: totalDebt * 0.3,
          bureauScore: 700
        },
        simulationConfig: {
          iterations: 50000,
          timeHorizonMonths: 12,
          unexpectedExpenseStdDev: 5000
        }
      }
    },
    salary_deduction: {
      scenario: "salary_deduction",
      parameters: {
        monthlyIncomeBeforeDeduction: monthlyIncome,
        deductionPercentage: extractNumberFromQuery(query, [10, 20, 30]),
        deductionDurationMonths: extractNumberFromQuery(query, [3, 6, 12]),
        expenseEstimate: {
          monthlyFixedExpenses: monthlyExpenses * 0.7,
          monthlyVariableExpenses: monthlyExpenses * 0.3
        },
        savingsAccountBalance: savingsBalance,
        simulationConfig: {
          iterations: 10000,
          timeHorizonMonths: 12,
          unexpectedExpenseStdDev: 3000
        }
      }
    },
    investment_stop: {
      scenario: "investment_stop", 
      parameters: {
        monthlyInvestmentAmount: extractNumberFromQuery(query, [500, 1000, 1500]),
        stopDurationMonths: extractNumberFromQuery(query, [3, 6, 12]),
        currentPortfolioValue: investmentBalance,
        expectedAnnualReturn: 0.08,
        simulationConfig: {
          iterations: 10000,
          timeHorizonMonths: 12,
          returnStdDev: 0.05
        }
      }
    },
    liability_stress: {
      scenario: "liability_stress",
      parameters: {
        monthlyDebtPayment: monthlyDebtPayments,
        interestRateIncreasePercent: extractNumberFromQuery(query, [25, 50, 100]),
        loanBalance: totalDebt,
        monthlyIncome: monthlyIncome,
        savingsBalance: savingsBalance,
        simulationConfig: {
          iterations: 10000,
          timeHorizonMonths: 12,
          incomeStdDev: 2000
        }
      }
    },
    emergency_expense: {
      scenario: "emergency_expense",
      parameters: {
        emergencyCost: extractNumberFromQuery(query, [3000, 5000, 8000]),
        emergencyMonth: Math.min(3, extractNumberFromQuery(query, [1, 2, 3])),
        monthlyIncome: monthlyIncome,
        monthlyExpenses: monthlyExpenses,
        savingsBalance: savingsBalance,
        simulationConfig: {
          iterations: 10000,
          timeHorizonMonths: 12,
          expenseStdDev: 3000
        }
      }
    }
  };

  return defaults[scenario] || { scenario, parameters: {} };
};

/**
 * Scenario Configurations with Enhanced Monte Carlo
 */
const scenarioConfigs = {
  job_loss: {
    schema: `{"scenario":"job_loss","parameters":{"monthlyIncomeBeforeLoss":<number>,"incomeLossStartDate":"<YYYY-MM-DD>","jobSearchDurationMonths":<number>,"expectedNewIncomeAfterRecovery":<number>,"expenseEstimate":{"monthlyFixedExpenses":<number>,"monthlyVariableExpenses":<number>},"savingsAndInvestments":{"savingsAccountBalance":<number>,"epfBalance":<number>,"mutualFunds":<number>,"securities":<number>},"creditObligations":{"totalOutstandingBalance":<number>,"securedOutstanding":<number>,"unsecuredOutstanding":<number>,"bureauScore":<number>},"simulationConfig":{"iterations":50000,"timeHorizonMonths":12,"unexpectedExpenseStdDev":5000}}}`,
    simulate: (params) => {
      const jobSearchDurationMonths = toNumber(params.jobSearchDurationMonths, 0);
      const expectedNewIncomeAfterRecovery = toNumber(params.expectedNewIncomeAfterRecovery, 0);
      const expenseEstimate = params.expenseEstimate || {};
      const savingsAndInvestments = params.savingsAndInvestments || {};
      const simulationConfig = params.simulationConfig || {};

      const liquidAssets = toNumber(savingsAndInvestments.savingsAccountBalance || 0) +
        0.5 * toNumber(savingsAndInvestments.mutualFunds || 0) +
        0.1 * toNumber(savingsAndInvestments.securities || 0);

      const fixed = toNumber(expenseEstimate.monthlyFixedExpenses || 0);
      const variableMean = toNumber(expenseEstimate.monthlyVariableExpenses || 0);
      const variableStd = toNumber(simulationConfig.unexpectedExpenseStdDev, 5000);

      const iterations = Math.max(1, toNumber(simulationConfig.iterations, 10000));
      const horizons = [3, 6, 12];
      const results = [];

      horizons.forEach((H) => {
        const endBalances = new Array(iterations);
        let ranOutCount = 0;

        for (let i = 0; i < iterations; i++) {
          let cash = liquidAssets;
          let ranOut = false;

          for (let m = 1; m <= H; m++) {
            let inflow = 0;
            if (m > jobSearchDurationMonths) {
              inflow = expectedNewIncomeAfterRecovery || 0;
            }

            let variable = variableMean + gaussianRandom(0, variableStd);
            if (variable < 0) variable = 0;

            let outflow = fixed + variable;
            cash += inflow - outflow;

            if (cash < 0) {
              ranOut = true;
              ranOutCount++;
              break;
            }
          }

          endBalances[i] = ranOut ? 0 : cash;
        }

        endBalances.sort((a, b) => a - b);

        const median = quantile(endBalances, 0.5);
        const p10 = quantile(endBalances, 0.1);
        const p90 = quantile(endBalances, 0.9);
        const probRunOut = ranOutCount / iterations;

        results.push({
          horizonMonths: H,
          probabilityRunOut: probRunOut,
          medianRemaining: median,
          percentile10: p10,
          percentile90: p90,
          initialLiquidAssets: liquidAssets,
        });
      });

      return results;
    },
    summaryPrompt: (simResults) => `You are FutureMirror. Summarize the "Job Loss" scenario. Simulation Results: ${JSON.stringify(simResults)}`
  },

  salary_deduction: {
    schema: `{"scenario":"salary_deduction","parameters":{"monthlyIncomeBeforeDeduction":<number>,"deductionPercentage":<number>,"deductionDurationMonths":<number>,"expenseEstimate":{"monthlyFixedExpenses":<number>,"monthlyVariableExpenses":<number>},"savingsAccountBalance":<number>,"simulationConfig":{"iterations":10000,"timeHorizonMonths":12,"unexpectedExpenseStdDev":5000}}}`,
    simulate: (params) => {
      const monthlyIncomeBeforeDeduction = toNumber(params.monthlyIncomeBeforeDeduction, 0);
      const deductionPercentage = toNumber(params.deductionPercentage, 0);
      const deductionDurationMonths = toNumber(params.deductionDurationMonths, 0);
      const expenseEstimate = params.expenseEstimate || {};
      const savingsAccountBalance = toNumber(params.savingsAccountBalance, 0);
      const simulationConfig = params.simulationConfig || {};

      const fixed = toNumber(expenseEstimate.monthlyFixedExpenses || 0);
      const variableMean = toNumber(expenseEstimate.monthlyVariableExpenses || 0);
      const variableStd = toNumber(simulationConfig.unexpectedExpenseStdDev, 5000);

      const iterations = Math.max(1, toNumber(simulationConfig.iterations, 10000));
      const horizons = [3, 6, 12];
      const results = [];

      horizons.forEach((H) => {
        const endBalances = new Array(iterations);

        for (let i = 0; i < iterations; i++) {
          let cash = savingsAccountBalance;

          for (let m = 1; m <= H; m++) {
            let income = monthlyIncomeBeforeDeduction;
            if (m <= deductionDurationMonths) {
              income *= 1 - deductionPercentage / 100;
            }

            let variable = variableMean + gaussianRandom(0, variableStd);
            if (variable < 0) variable = 0;

            let outflow = fixed + variable;
            cash += income - outflow;
          }

          endBalances[i] = cash;
        }

        endBalances.sort((a, b) => a - b);

        const median = quantile(endBalances, 0.5);
        const p10 = quantile(endBalances, 0.1);
        const p90 = quantile(endBalances, 0.9);

        results.push({
          horizonMonths: H,
          medianRemaining: median,
          percentile10: p10,
          percentile90: p90,
          initialSavings: savingsAccountBalance,
        });
      });

      return results;
    },
    summaryPrompt: (simResults) => `You are FutureMirror. Summarize the "Salary Deduction" scenario. Simulation Results: ${JSON.stringify(simResults)}`
  },

  investment_stop: {
    schema: `{"scenario":"investment_stop","parameters":{"monthlyInvestmentAmount":<number>,"stopDurationMonths":<number>,"currentPortfolioValue":<number>,"expectedAnnualReturn":<number>,"simulationConfig":{"iterations":10000,"timeHorizonMonths":12,"returnStdDev":0.05}}}`,
    simulate: (params) => {
      const monthlyInvestmentAmount = toNumber(params.monthlyInvestmentAmount, 0);
      const stopDurationMonths = toNumber(params.stopDurationMonths, 0);
      const currentPortfolioValue = toNumber(params.currentPortfolioValue, 0);
      const expectedAnnualReturn = toNumber(params.expectedAnnualReturn, 0);
      const simulationConfig = params.simulationConfig || {};

      const iterations = Math.max(1, toNumber(simulationConfig.iterations, 10000));
      const horizons = [3, 6, 12];
      const stdDev = toNumber(simulationConfig.returnStdDev, 0.05);

      const results = [];

      horizons.forEach((H) => {
        const endValues = new Array(iterations);

        for (let i = 0; i < iterations; i++) {
          let value = currentPortfolioValue;

          for (let m = 1; m <= H; m++) {
            const monthlyMean = expectedAnnualReturn / 12;
            const monthlyReturn = monthlyMean + gaussianRandom(0, stdDev);

            value *= 1 + monthlyReturn;

            if (m > stopDurationMonths) {
              value += monthlyInvestmentAmount;
            }
          }

          endValues[i] = value;
        }

        endValues.sort((a, b) => a - b);

        const median = quantile(endValues, 0.5);
        const p10 = quantile(endValues, 0.1);
        const p90 = quantile(endValues, 0.9);

        results.push({
          horizonMonths: H,
          medianPortfolio: median,
          percentile10: p10,
          percentile90: p90,
          initialPortfolio: currentPortfolioValue,
        });
      });

      return results;
    },
    summaryPrompt: (simResults) => `You are FutureMirror. Summarize the "Investment Stop" scenario. Simulation Results: ${JSON.stringify(simResults)}`
  },

  liability_stress: {
    schema: `{"scenario":"liability_stress","parameters":{"monthlyDebtPayment":<number>,"interestRateIncreasePercent":<number>,"loanBalance":<number>,"monthlyIncome":<number>,"savingsBalance":<number>,"simulationConfig":{"iterations":10000,"timeHorizonMonths":12,"incomeStdDev":2000}}}`,
    simulate: (params) => {
      const monthlyDebtPayment = toNumber(params.monthlyDebtPayment, 0);
      const interestRateIncreasePercent = toNumber(params.interestRateIncreasePercent, 0);
      const loanBalance = toNumber(params.loanBalance, 0);
      const monthlyIncome = toNumber(params.monthlyIncome, 0);
      const savingsBalance = toNumber(params.savingsBalance, 0);
      const simulationConfig = params.simulationConfig || {};

      const iterations = Math.max(1, toNumber(simulationConfig.iterations, 10000));
      const horizons = [3, 6, 12];
      const incomeStd = toNumber(simulationConfig.incomeStdDev, 2000);

      const stressedDebt = monthlyDebtPayment * (1 + interestRateIncreasePercent / 100);

      const results = [];

      horizons.forEach((H) => {
        const balances = new Array(iterations);

        for (let i = 0; i < iterations; i++) {
          let cash = savingsBalance;

          for (let m = 1; m <= H; m++) {
            let income = monthlyIncome + gaussianRandom(0, incomeStd);
            if (income < 0) income = 0;

            cash += income - stressedDebt;
          }

          balances[i] = cash;
        }

        balances.sort((a, b) => a - b);

        const median = quantile(balances, 0.5);
        const p10 = quantile(balances, 0.1);
        const p90 = quantile(balances, 0.9);

        results.push({
          horizonMonths: H,
          medianRemaining: median,
          percentile10: p10,
          percentile90: p90,
          stressedDebt,
        });
      });

      return results;
    },
    summaryPrompt: (simResults) => `You are FutureMirror. Summarize the "Liability Stress" scenario. Simulation Results: ${JSON.stringify(simResults)}`
  },

  emergency_expense: {
    schema: `{"scenario":"emergency_expense","parameters":{"emergencyCost":<number>,"emergencyMonth":<number>,"monthlyIncome":<number>,"monthlyExpenses":<number>,"savingsBalance":<number>,"simulationConfig":{"iterations":10000,"timeHorizonMonths":12,"expenseStdDev":3000}}}`,
    simulate: (params) => {
      const emergencyCost = toNumber(params.emergencyCost, 0);
      const emergencyMonth = toNumber(params.emergencyMonth, 1);
      const monthlyIncome = toNumber(params.monthlyIncome, 0);
      const monthlyExpenses = toNumber(params.monthlyExpenses, 0);
      const savingsBalance = toNumber(params.savingsBalance, 0);
      const simulationConfig = params.simulationConfig || {};

      const iterations = Math.max(1, toNumber(simulationConfig.iterations, 10000));
      const horizons = [3, 6, 12];
      const expStd = toNumber(simulationConfig.expenseStdDev, 3000);

      const results = [];

      horizons.forEach((H) => {
        const balances = new Array(iterations);
        let ranOutCount = 0;

        for (let i = 0; i < iterations; i++) {
          let cash = savingsBalance;
          let ranOut = false;

          for (let m = 1; m <= H; m++) {
            let expenses = monthlyExpenses + gaussianRandom(0, expStd);
            if (expenses < 0) expenses = 0;

            if (m === emergencyMonth) {
              expenses += emergencyCost;
            }

            cash += monthlyIncome - expenses;

            if (cash < 0) {
              ranOut = true;
              ranOutCount++;
              break;
            }
          }

          balances[i] = ranOut ? 0 : cash;
        }

        balances.sort((a, b) => a - b);

        const median = quantile(balances, 0.5);
        const p10 = quantile(balances, 0.1);
        const p90 = quantile(balances, 0.9);
        const probRunOut = ranOutCount / iterations;

        results.push({
          horizonMonths: H,
          probabilityRunOut: probRunOut,
          medianRemaining: median,
          percentile10: p10,
          percentile90: p90,
          emergencyCost,
          emergencyMonth,
        });
      });

      return results;
    },
    summaryPrompt: (simResults) => `You are FutureMirror. Summarize the "Emergency Expense" scenario. Simulation Results: ${JSON.stringify(simResults)}`
  }
};

/**
 * Extract JSON safely from model output
 */
function extractJson(text) {
  if (!text || typeof text !== "string") return null;
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (err) {
        return null;
      }
    }
    return null;
  }
}

/**
 * Get scenario parameters from Gemini with enhanced query processing
 */
const getScenarioParamsFromGemini = async (scenario, query, financialMetrics) => {
  const schema = scenarioConfigs[scenario].schema;

  const prompt = `
You are FutureMirror, a financial assistant analyzing the user's specific scenario query.

USER QUERY: "${query}"

SCENARIO: ${scenario}

USER FINANCIAL PROFILE:
- Monthly Income: RM${financialMetrics.monthlyIncome}
- Monthly Expenses: RM${financialMetrics.monthlyExpenses}
- Savings Balance: RM${financialMetrics.savingsBalance}
- Investment Balance: RM${financialMetrics.investmentBalance}
- Total Debt: RM${financialMetrics.totalDebt}
- Credit Score: ${financialMetrics.creditScore}

ANALYZE THE USER'S QUERY CAREFULLY and extract specific parameters mentioned. If the query mentions specific amounts, durations, or percentages, USE THOSE EXACT VALUES. If not specified, make reasonable estimates based on the financial profile.

RETURN ONLY VALID JSON, no extra text.

REQUIRED JSON FORMAT: ${schema}

EXAMPLES:
- If query says "lost job for 6 months", set jobSearchDurationMonths: 6
- If query says "20% salary cut", set deductionPercentage: 20  
- If query says "RM5000 emergency", set emergencyCost: 5000
- If query says "stop investing for 3 months", set stopDurationMonths: 3

NOW GENERATE PARAMETERS SPECIFIC TO THIS QUERY:
`;

  try {
    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { 
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      }
    );

    let jsonText = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";
    const parsed = extractJson(jsonText);
    
    if (!parsed) {
      return getDefaultParameters(scenario, financialMetrics, query);
    }
    
    return parsed;
  } catch (error) {
    console.error("Gemini API error:", error.message);
    return getDefaultParameters(scenario, financialMetrics, query);
  }
};

/**
 * Summarize simulation results with Gemini
 */
const summarizeResultsWithGemini = async (scenario, simResults, userQuery) => {
  const prompt = `You are FutureMirror, a financial guide. Your job is to explain simulation results in plain, everyday language.
The user asked: "${userQuery}" (Use this for giving over all section)

Write a short summary with these sections:

**3-Month Outlook**
- Start by reminding the reader of their current savings (initial liquid assets).
- Then share the worst case (10th percentile), likely case (median), and best case (90th percentile) in rupees.
- Explain what this means in real life terms (e.g., "you’d still have a safety cushion for essentials").

**6-Month Outlook**
- Compare balances here to both current savings and the 3-month outlook.
- Share the three cases again in rupees.
- Explain in simple words why balances are lower than at 3 months (because savings are being used steadily).
- Describe how this would feel in real life (tighter budget, needing to be cautious).

**12-Month Outlook**
- Again, compare to current savings and the 6-month balances.
- Share the three cases in rupees.
- Explain in plain words why balances rise again compared to 6 months (income recovery, reduced spending, or savings starting to rebuild).
- Emphasize how this feels more stable or hopeful.

**Overall**
- Clearly connect the story across 3 → 6 → 12 months: 
  - At first, savings hold up compared to what you started with.
  - Then they shrink as you rely on them.
  - Later, things improve as money starts flowing back in.
- Always explain "why" these changes happen in real life terms, not just numbers.
- Comment briefly on the probability of running out (reassuring if it’s very low).
- Also provide user what he can do to improve his situation specific to query and indian context.

Guidelines:
- Keep it under 250 words.
- Always show rupee amounts with ₹.
- Mention current savings at least once for context.
- Avoid technical or statistical jargon. Say “worst case,” “likely,” “best case.”
- Use a supportive, human tone like explaining to a friend. 

Simulation Results:
${scenarioConfigs[scenario].summaryPrompt(simResults)}`;
  
  const geminiRes = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { contents: [{ parts: [{ text: prompt }] }] }
  );

  return (
    geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
    "No summary available."
  );
};




/**
 * Main controller
 */
exports.postFuture = async (req, res) => {
  const { query, uid, scenario } = req.body;

  if (!query || !uid || !scenario) {
    return res.status(400).json({ reply: "Missing query, uid, or scenario in request body." });
  }

  try {
    if (!scenarioConfigs[scenario]) {
      return res.status(400).json({ reply: "Unsupported scenario." });
    }

    const fullUserData = await getAllUserData(uid);
    const financialMetrics = calculateFinancialMetrics(fullUserData);

    const scenarioParams = await getScenarioParamsFromGemini(scenario, query, financialMetrics);
    
    if (!scenarioParams) {
      return res.status(500).json({ reply: "Failed to extract scenario parameters." });
    }

    const simResults = scenarioConfigs[scenario].simulate(scenarioParams.parameters);

    console.log("Simulation Results:", simResults);
    
    const summary = await summarizeResultsWithGemini(scenario, simResults, query);

    console.log("Summary:", summary);

    return res.json({
      reply: summary,
      simulation: simResults,
      parameters: scenarioParams,
      financialMetrics: financialMetrics
    });
  } catch (err) {
    console.error("Error in postFuture:", err.message);
    return res.status(500).json({ reply: "Internal server error." });
  }
};