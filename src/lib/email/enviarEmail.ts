import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }
  return transporter;
}

export interface AdjuntoEmail {
  filename: string;
  content: Buffer;
  contentType?: string;
}

interface EnviarEmailInput {
  to: string;
  subject: string;
  text: string;
  attachments?: AdjuntoEmail[];
}

// Nunca lanza — devuelve {ok:false, error} en vez de tirar excepción, para
// que el llamador decida cómo mostrarlo sin romper el flujo principal
// (completar un evento de bitácora, crear un caso, etc. no deben fallar
// por un problema de envío de mail).
export async function enviarEmail({ to, subject, text, attachments }: EnviarEmailInput): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return { ok: false, error: "GMAIL_USER/GMAIL_APP_PASSWORD no están configurados." };
  }

  try {
    await getTransporter().sendMail({
      from: `Oltra Gestión Integral <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
      ...(attachments && attachments.length > 0 ? { attachments } : {})
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo enviar el mail." };
  }
}
