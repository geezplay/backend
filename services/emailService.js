const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

// Format currency
const formatPrice = (price) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(price);
};

// Send transaction receipt with photos
const sendTransactionEmail = async (order, orderItems) => {
    try {
        const { Order, OrderItem, Photo, RecapPhoto } = require('../models');

        // Build item rows for email
        let itemsHtml = '';
        const attachments = [];

        for (let i = 0; i < orderItems.length; i++) {
            const item = orderItems[i];

            itemsHtml += `
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #eee;">${i + 1}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.snap_event_name || 'Event'}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.snap_photo_start_no || '-'}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #eee;">Varian ${item.variant}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${formatPrice(item.price)}</td>
                </tr>
            `;

            // Get photo file for attachment
            const photo = await Photo.findByPk(item.photo_id, {
                include: [{ model: RecapPhoto, as: 'recaps' }]
            });

            if (photo) {
                // Find recap matching variant
                const recap = photo.recaps?.find(r => r.variant_number === item.variant);

                let filePath;
                let filename;

                if (recap) {
                    filePath = path.join(__dirname, '..', 'uploads', 'recaps', recap.getDataValue('file_path'));
                    filename = `foto-${item.snap_photo_start_no || item.photo_id}-v${item.variant}.jpg`;
                } else {
                    const photoPath = photo.getDataValue('url');
                    filePath = path.join(__dirname, '..', photoPath);
                    filename = `foto-${item.snap_photo_start_no || item.photo_id}.jpg`;
                }

                // Check if file exists before adding attachment
                if (fs.existsSync(filePath)) {
                    attachments.push({
                        filename: filename,
                        path: filePath
                    });
                }
            }
        }

        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1a1a1a, #333); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .logo { color: #39FF14; font-weight: 900; font-size: 28px; }
        .content { padding: 30px; }
        .success-badge { background: #39FF14; color: black; display: inline-block; padding: 8px 20px; border-radius: 20px; font-weight: bold; margin-bottom: 20px; }
        .order-info { background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .order-info p { margin: 8px 0; color: #555; }
        .order-info strong { color: #333; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #333; color: white; padding: 12px; text-align: left; }
        .total-row { background: #f0f0f0; font-weight: bold; }
        .total-row td { padding: 15px 12px; }
        .footer { background: #1a1a1a; color: #888; padding: 20px; text-align: center; font-size: 12px; }
        .accent { color: #39FF14; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">GEEZ<span class="accent">PLAY</span></div>
            <h1>Struk Transaksi</h1>
        </div>
        
        <div class="content">
            <div style="text-align: center;">
                <span class="success-badge">✓ PEMBAYARAN BERHASIL</span>
            </div>
            
            <div class="order-info">
                <p><strong>Order ID:</strong> #${order.id}</p>
                <p><strong>Email:</strong> ${order.email}</p>
                <p><strong>WhatsApp:</strong> ${order.whatsapp || '-'}</p>
                <p><strong>Tanggal:</strong> ${new Date(order.created_at).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}</p>
            </div>
            
            <h3 style="color: #333; margin-bottom: 10px;">Detail Pembelian</h3>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Event</th>
                        <th>Start No</th>
                        <th>Varian</th>
                        <th style="text-align: right;">Harga</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                    <tr class="total-row">
                        <td colspan="4" style="text-align: right;"><strong>TOTAL</strong></td>
                        <td style="text-align: right; color: #39FF14;"><strong>${formatPrice(order.total_price)}</strong></td>
                    </tr>
                </tbody>
            </table>
            
            <p style="color: #666; font-size: 14px;">
                📷 <strong>Foto yang Anda beli terlampir dalam email ini.</strong><br>
                Simpan foto-foto ini dengan aman. Jika ada pertanyaan, silakan hubungi kami.
            </p>
        </div>
        
        <div class="footer">
            <p>Terima kasih telah berbelanja di GEEZPLAY!</p>
            <p>© ${new Date().getFullYear()} GEEZPLAY. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;

        // Send email
        const mailOptions = {
            from: `"GEEZPLAY" <${process.env.MAIL_USER}>`,
            to: order.email,
            subject: `✓ Struk Transaksi GEEZPLAY - Order #${order.id}`,
            html: emailHtml,
            attachments: attachments
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    transporter,
    sendTransactionEmail
};
