const nodemailer = require('nodemailer')

require('dotenv').config()

async function sendEmail(to, event) {
    const subject = `${event} 時間投票通知`
    const text = `提醒：${event}的投票時間只剩兩小時了，請儘速完成投票！`

    const mailOptions = {
        from: process.env.MAIL_ACCOUNT,
        to: to,
        subject: subject,
        text: text
    };

    // Nodemailer setup
    const transporter = nodemailer.createTransport({
        service: process.env.MAIL_TYPE,
        auth: {
        user: process.env.MAIL_ACCOUNT,
        pass: process.env.MAIL_PASSWORD
        }
    });

    await transporter.sendMail(mailOptions, function(error, info){
        if (error) {
        console.log(error);
        } else {
        console.log('Email sent: ' + info.response);
        }
    });
}

module.exports = sendEmail
