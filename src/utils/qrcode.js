const QRCode = require('qrcode');

/**
 * Generate standard UPI payment URI
 * @param {object} params
 * @param {string} params.upiId - UPI VPA (e.g. xdsellerkeshav@fam)
 * @param {string} params.name - Account name (e.g. LEGEND)
 * @param {bigint|number} params.amountPaise - Amount in integer paise
 * @returns {string}
 */
const generateUpiPayString = ({ upiId, name, amountPaise }) => {
  const paise = BigInt(amountPaise || 0);
  const rupees = (Number(paise) / 100).toFixed(2);
  const cleanUpi = upiId.trim();
  const cleanName = encodeURIComponent(name.trim());
  return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${rupees}&cu=INR`;
};

/**
 * Generate a PNG Buffer of the UPI QR Code
 * @param {object} params
 * @param {string} params.upiId
 * @param {string} params.name
 * @param {bigint|number} params.amountPaise
 * @returns {Promise<Buffer>}
 */
const generateUpiQrBuffer = async ({ upiId, name, amountPaise }) => {
  const upiUrl = generateUpiPayString({ upiId, name, amountPaise });
  return QRCode.toBuffer(upiUrl, {
    width: 450,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });
};

module.exports = {
  generateUpiPayString,
  generateUpiQrBuffer,
};
