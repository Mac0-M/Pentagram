// consistency-worker.js
self.addEventListener('message', function(e) {
    const { type, payload } = e.data;

    if (type === 'CALCULATE_MONTH_CALENDAR') {
        const { activityData, year, month } = payload;
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const firstWeekDay = firstDay.getDay(); // 0 (อาทิตย์) ถึง 6 (เสาร์)
        const daysInMonth = lastDay.getDate();

        // คำนวณบล็อกทั้งหมดให้เต็มสัปดาห์ (Grid Matrix 7 คอลัมน์)
        const totalCells = Math.ceil((firstWeekDay + daysInMonth) / 7) * 7;
        const calendarDays = [];

        let dayNum = 1 - firstWeekDay;
        for (let i = 0; i < totalCells; i++, dayNum++) {
            let cell = { date: null, count: 0, colorClass: "level-empty" };
            
            if (dayNum > 0 && dayNum <= daysInMonth) {
                const mStr = String(month + 1).padStart(2, '0');
                const dStr = String(dayNum).padStart(2, '0');
                const dateString = `${year}-${mStr}-${dStr}`;
                
                // ค้นหาจำนวนการเล่นจาก Database จริง
                const count = activityData ? (activityData[dateString] || 0) : 0;

                // ตรรกะจำแนกโทนสีสไตล์ Pentagram
                let colorClass = "level-0"; 
                if (count >= 5) colorClass = "level-3";      
                else if (count >= 3) colorClass = "level-2";
                else if (count >= 1) colorClass = "level-1";

                cell = { date: dateString, count, colorClass, dayNum };
            }
            calendarDays.push(cell);
        }

        // ส่งข้อมูลบล็อกที่พร้อมวาด UI กลับไปยัง Main Thread
        self.postMessage({ type: 'CALENDAR_RENDER_READY', calendarDays });
    }
});