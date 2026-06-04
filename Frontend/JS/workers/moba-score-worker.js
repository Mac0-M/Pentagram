// moba-score-worker.js

function getMobaTierLabel(score) {
    if (score >= 901) return "Pentagram Grandmaster";
    if (score >= 751) return "Diamond Immortal";
    if (score >= 601) return "Platinum Overlord";
    if (score >= 451) return "Gold Sentinel";
    if (score >= 301) return "Silver Tactician";
    if (score >= 151) return "Bronze Challenger";
    return "Iron Vanguard";
}

self.addEventListener('message', function(e) {
    const { type, payload } = e.data;

    if (type === 'COMPUTE_CROSS_GAME_STATUS') {
        const { dotaRaw, lolRaw } = payload;

        // ดึงจำนวนนัดแข่งขันเพื่อใช้จำกัดค่าน้ำหนักไม่ให้เกิน 1
        const matchesDota = dotaRaw?.matchesCount || 0;
        const matchesLol = lolRaw?.matchesCount || 0;

        const w_d = Math.min(1, matchesDota / 100);
        const w_l = Math.min(1, matchesLol / 100);
        const totalWeight = w_d + w_l || 1;

        // ฟังก์ชันช่วยประมวลผลสมการเฉลี่ยถ่วงน้ำหนัก (Weighted Average) ฐาน 100
        const runWeightFormula = (dotaVal, lolVal) => {
            return Math.round(((w_d * dotaVal) + (w_l * lolVal)) / totalWeight);
        };

        // คำนวณค่าเฉลี่ยดิบ (ฐาน 100) ของแต่ละหมวดหมู่
        const rawRankSkill = runWeightFormula(dotaRaw?.rankPercentile || 0, lolRaw?.rankPercentile || 0);
        const rawWinEfficiency = runWeightFormula(dotaRaw?.winEff || 0, lolRaw?.winEff || 0);
        const rawCombatPerformance = runWeightFormula(dotaRaw?.combatPercentile || 0, lolRaw?.combatPercentile || 0);
        const rawEconomySkill = runWeightFormula(dotaRaw?.economyPercentile || 0, lolRaw?.economyPercentile || 0);

        // รวมเป็นคะแนนดัชนีภาพรวม MOBA Skill Score (แปลงเป็นสเกลเต็ม 1000 แต้ม)
        const combinedAvg = (0.25 * rawRankSkill) + (0.25 * rawWinEfficiency) + (0.25 * rawCombatPerformance) + (0.25 * rawEconomySkill);
        const finalMobaScore = Math.min(1000, Math.max(0, Math.round(combinedAvg * 10)));
        const finalRankLabel = getMobaTierLabel(finalMobaScore);

        // 🔥 BUG FIX: ปรับคะแนนย่อยทั้ง 4 แกนให้ขยายเต็ม 1000 เท่ากัน สอดคล้องกับ server.js และหลอดความยาวหน้าเว็บ
        const finalRankSkill = Math.min(1000, rawRankSkill * 10);
        const finalWinEfficiency = Math.min(1000, rawWinEfficiency * 10);
        const finalCombatPerformance = Math.min(1000, rawCombatPerformance * 10);
        const finalEconomySkill = Math.min(1000, rawEconomySkill * 10);

        // ส่ง Object ผลลัพธ์สุดท้ายกลับไปให้หน้าโปรไฟล์อัปเดต UI ได้ทันที
        self.postMessage({
            type: 'MOBA_SCORE_COMPUTED',
            crossGameStatus: {
                mobaScore: finalMobaScore,
                rank: finalRankLabel,
                rankSkill: finalRankSkill,
                winEfficiency: finalWinEfficiency,
                combatPerformance: finalCombatPerformance,
                economySkill: finalEconomySkill
            }
        });
    }
});