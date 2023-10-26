function split30(interval) {
    const result = [];
    
    let currentStartTime = new Date(interval.startTime);
    const endTime = new Date(interval.endTime);
    
    while (currentStartTime < endTime) {
      const nextEndTime = new Date(currentStartTime);
      nextEndTime.setMinutes(currentStartTime.getMinutes() + 30);
      
      result.push({
        startTime: currentStartTime,
        endTime: nextEndTime,
      });
      
      currentStartTime = nextEndTime;
    }
    
    return result;
}

function isValidIntervals(intervals) {
    const len = intervals.length
    for(let i = 0; i < len; i++) {
        const {startTime, endTime} = intervals[i]
        if (!(new Date(startTime) instanceof Date) || !(new Date(endTime) instanceof Date)) {
            return false
        }
        if(startTime >= endTime) return false
    }
    return true
}

module.exports = {split30, isValidIntervals}