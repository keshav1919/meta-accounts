import io
import urllib.parse
import qrcode
from qrcode.constants import ERROR_CORRECT_M

def generate_upi_pay_string(upi_id: str, name: str, amount_paise: int) -> str:
    rupees = f"{amount_paise / 100.0:.2f}"
    clean_upi = upi_id.strip()
    clean_name = urllib.parse.quote(name.strip())
    return f"upi://pay?pa={clean_upi}&pn={clean_name}&am={rupees}&cu=INR"

def generate_upi_qr_bytes(upi_id: str, name: str, amount_paise: int) -> bytes:
    upi_url = generate_upi_pay_string(upi_id, name, amount_paise)
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(upi_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer.getvalue()
