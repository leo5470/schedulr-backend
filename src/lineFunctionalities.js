function lineCreateRemindMessage(event) {
    const text = `提醒：${event}的投票時間只剩兩小時了，請儘速完成投票！`
    return [{ type: 'text', text: `${text}`}]
}

module.exports = lineCreateRemindMessage