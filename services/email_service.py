import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv
_ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "env.env")
load_dotenv(_ENV_PATH)
def send_mail(to_email, subject, body):

    try:
        # Sender credentials
        sender_email = os.getenv("Email")
        sender_password = os.getenv("Email_Password")

        # Create email
        message = MIMEMultipart()

        message["From"] = sender_email
        message["To"] = to_email
        message["Subject"] = subject

        # Email body
        message.attach(MIMEText(body, "html"))

        # Connect to Gmail SMTP Server
        server = smtplib.SMTP("smtp.gmail.com", 587)

        # Secure the connection
        server.starttls()

        # Login
        server.login(sender_email, sender_password)

        # Send email
        server.sendmail(
            sender_email,
            to_email,
            message.as_string()
        )

        # Close connection
        server.quit()

        print("Email sent successfully.")
        return True

    except Exception as e:
        print("Email sending failed:", e)
        return False