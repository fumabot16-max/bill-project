import fs from 'fs';

const USAGE_PATH = '/root/.openclaw/workspace/ai-bill/dist/usage.json';
const PRICES_PATH = '/root/.openclaw/workspace/ai-bill/prices.json';
const SESSION_PATH = '/root/.openclaw/agents/main/sessions/sessions.json';
const VAULT_PATH = '/root/.openclaw/workspace/ai-bill/vault.json';
const WEB_LIVE_PATH = '/var/www/html/bill/usage_live.json';
const WEB_MAIN_PATH = '/var/www/html/bill/usage.json';
const DEBUG_LOG = '/root/.openclaw/workspace/tiger-bill-test/debug.log';
const CUMULATIVE_PATH = '/root/.openclaw/workspace/ai-bill/cumulative_usage.json';

// 누적 사용량 저장 (세션 압축에도 보존)
function loadCumulative() {
    if (fs.existsSync(CUMULATIVE_PATH)) {
        try {
            return JSON.parse(fs.readFileSync(CUMULATIVE_PATH, 'utf8'));
        } catch (e) {
            console.error('Failed to load cumulative:', e.message);
        }
    }
    return { openai: 0, claude: 0, gemini: 0, kimi: 0, deepseek: 0, grok: 0, lastReset: new Date().toISOString() };
}

function saveCumulative(data) {
    try {
        fs.writeFileSync(CUMULATIVE_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Failed to save cumulative:', e.message);
    }
}

// 세션별 토큰 추적 (중복 방지)
const processedSessions = new Map();

async function calculateUsage() {
    try {
        if (!fs.existsSync(SESSION_PATH)) return;

        let sessionsRaw;
        try {
            sessionsRaw = fs.readFileSync(SESSION_PATH, 'utf8');
            if (!sessionsRaw || sessionsRaw.trim() === '') throw new Error("Empty file");
        } catch (e) {
            console.log(`[${new Date().toLocaleTimeString()}] Session file busy, retrying...`);
            return;
        }

        const sessions = JSON.parse(sessionsRaw);
        const prices = JSON.parse(fs.readFileSync(PRICES_PATH, 'utf8'));
        
        let vault = { openai: 0, claude: 0, grok: 0, kimi: 0, deepseek: 0, gemini: 0 };
        if (fs.existsSync(VAULT_PATH)) {
            vault = JSON.parse(fs.readFileSync(VAULT_PATH, 'utf8'));
        }
        
        // 누적 사용량 로드
        const cumulative = loadCumulative();
        
        // 현재 세션 사용량 계산
        const currentUsage = { openai: 0, claude: 0, gemini: 0, kimi: 0, deepseek: 0, grok: 0 };
        const stats = { openai: {}, claude: {}, gemini: {}, kimi: {}, deepseek: {}, grok: {} };
        let debugInfo = [];
        let newTokensFound = false;

        Object.entries(sessions).forEach(([sessionKey, s]) => {
            // model 확인 - 우선순위: modelOverride > providerOverride > model
            let modelFull = '';
            if (s.modelOverride) modelFull = s.modelOverride.toLowerCase();
            else if (s.providerOverride) modelFull = s.providerOverride.toLowerCase();
            else if (s.model) modelFull = s.model.toLowerCase();
            
            const inTokens = s.inputTokens || 0;
            const outTokens = s.outputTokens || 0;
            const sessionId = s.sessionId || sessionKey;
            
            // 중복 체크: 세션 ID + 토큰 합으로 고유 식별
            const tokenSum = inTokens + outTokens;
            const sessionSignature = `${sessionId}:${tokenSum}`;
            
            if (inTokens > 0 || outTokens > 0) {
                debugInfo.push(`${sessionKey.split(':').pop()}: ${inTokens}/${outTokens} -> ${modelFull || 'NO_MODEL'}`);
                
                // 새로운 토큰만 누적에 추가
                if (!processedSessions.has(sessionSignature)) {
                    processedSessions.set(sessionSignature, { in: inTokens, out: outTokens, time: Date.now() });
                    newTokensFound = true;
                }
            }
            
            let brand = '';
            if (modelFull.includes('claude')) brand = 'claude';
            else if (modelFull.includes('gemini')) brand = 'gemini';
            else if (modelFull.includes('gpt')) brand = 'openai';
            else if (modelFull.includes('kimi')) brand = 'kimi';
            else if (modelFull.includes('deepseek')) brand = 'deepseek';
            else if (modelFull.includes('grok')) brand = 'grok';

            if (brand && prices[brand] && (inTokens > 0 || outTokens > 0)) {
                let priceInfo = null;
                const modelKey = Object.keys(prices[brand]).find(k => modelFull.includes(k));
                priceInfo = modelKey ? prices[brand][modelKey] : prices[brand][Object.keys(prices[brand])[0]];

                if (priceInfo) {
                    const cost = (inTokens * (priceInfo.in / 1000000)) + (outTokens * (priceInfo.out / 1000000));
                    currentUsage[brand] += cost;

                    const verLabel = modelFull.split('/').pop().replace(/-/g, ' ').toUpperCase();
                    stats[brand][verLabel] = (stats[brand][verLabel] || 0) + (inTokens + outTokens);
                    
                    // 새로운 토큰을 누적에 추가
                    const sessionRecord = processedSessions.get(sessionSignature);
                    if (sessionRecord && !sessionRecord.addedToCumulative) {
                        const tokenCost = (inTokens * (priceInfo.in / 1000000)) + (outTokens * (priceInfo.out / 1000000));
                        cumulative[brand] += tokenCost;
                        sessionRecord.addedToCumulative = true;
                    }
                }
            }
        });

        // 누적 사용량 저장 (세션 압축에도 보존)
        if (newTokensFound) {
            saveCumulative(cumulative);
        }

        // 디버그 로그 기록
        fs.writeFileSync(DEBUG_LOG, debugInfo.join('\n'));

        // 최종 사용량 = 누적 + 현재
        const usageData = { 
            timestamp: new Date().toISOString(), 
            models: {}
        };

        Object.keys(cumulative).forEach(k => {
            if (k === 'lastReset' || k === 'note') return;
            const cumul = parseFloat(cumulative[k]) || 0;
            const curr = parseFloat(currentUsage[k]) || 0;
            const totalCost = cumul + curr;
            usageData.models[k] = totalCost.toFixed(4);
            usageData.models[k + '_bal'] = (k === 'gemini') ? "POST" : (parseFloat(vault[k] || 0) - totalCost).toFixed(2);
            usageData.models[k + '_stats'] = stats[k];
        });

        const jsonStr = JSON.stringify(usageData, null, 2);
        fs.writeFileSync(USAGE_PATH, jsonStr);
        fs.writeFileSync(WEB_LIVE_PATH, jsonStr);
        fs.writeFileSync(WEB_MAIN_PATH, jsonStr);
        
        console.log(`[${new Date().toLocaleTimeString()}] Sync OK | Cumulative + Current Mode`);
    } catch (e) { 
        console.error(`[${new Date().toLocaleTimeString()}] Engine Error:`, e.message); 
    }
}

// 초기 실행
calculateUsage();
setInterval(calculateUsage, 30000);

// 1시간마다 메모리 정리 (오래된 세션 기록 삭제)
setInterval(() => {
    const oneHourAgo = Date.now() - 3600000;
    for (const [key, value] of processedSessions.entries()) {
        if (value.time < oneHourAgo) {
            processedSessions.delete(key);
        }
    }
}, 3600000);
