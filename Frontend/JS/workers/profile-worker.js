self.addEventListener('message', function(e) {
    const { type, payload } = e.data;

    if (type === 'CALCULATE_MONTH_CALENDAR') {
        const { activityData, year, month } = payload;
        
        // หาวันแรกและวันสุดท้ายของเดือนนั้น
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const firstWeekDay = firstDay.getDay(); // 0 (อาทิตย์) ถึง 6 (เสาร์)
        const daysInMonth = lastDay.getDate();

        // คำนวณจำนวนช่องทั้งหมดที่ต้องวาด (รวมช่องว่างก่อนเริ่มเดือนและหลังจบเดือนให้เต็มแถว)
        const totalCells = Math.ceil((firstWeekDay + daysInMonth) / 7) * 7;
        const calendarDays = [];

        let dayNum = 1 - firstWeekDay;
        for (let i = 0; i < totalCells; i++, dayNum++) {
            let cell = { date: null, count: 0, colorClass: "level-empty" };
            
            // ถ้าเป็นวันที่ที่มีอยู่จริงในเดือนนี้
            if (dayNum > 0 && dayNum <= daysInMonth) {
                // สร้าง String YYYY-MM-DD เพื่อไปเทียบกับ Data
                const mStr = String(month + 1).padStart(2, '0');
                const dStr = String(dayNum).padStart(2, '0');
                const dateString = `${year}-${mStr}-${dStr}`;
                
                const count = activityData[dateString] || 0;

                // Color Logic สไตล์ GitHub ตามที่คุณสั่ง
                let colorClass = "level-0"; // 0 match (สีเหลือง/เทา)
                if (count >= 5) colorClass = "level-3"; // 5+ match (เขียวเข้ม)
                else if (count >= 3) colorClass = "level-2"; // 3-5 match (เขียวกลาง)
                else if (count >= 1) colorClass = "level-1"; // 1-2 match (เขียวอ่อน)

                cell = { date: dateString, count, colorClass, dayNum };
            }
            calendarDays.push(cell);
        }

        self.postMessage({
            type: 'RENDER_CALENDAR',
            payload: { calendarDays, year, month }
        });
    }
});