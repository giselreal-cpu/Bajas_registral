import Image from "next/image";
import Link from "next/link";
import {
  EMAIL_CONTACTO,
  HORARIO_ATENCION,
  WHATSAPP_VISIBLE,
  ZONA_DE_TRABAJO,
  whatsappUrl
} from "@/lib/contacto";

// Portada pública (/): lo que ve quien entra sin sesión. Los logos de las
// compañías y el detalle del proceso quedaron afuera a propósito (ver
// README). Todo es markup estático: sin estado ni JS en el cliente.

const WA_GLYPH =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";

function IconoWhatsApp({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={WA_GLYPH} />
    </svg>
  );
}

function Icono({ paths, size = 24, className }: { paths: string[]; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const DESTINATARIOS = [
  { texto: "Asegurados", paths: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"] },
  { texto: "Productores", paths: ["M3 8h18v12H3z", "M9 8V5h6v3"] },
  {
    texto: "Compañías de seguros",
    paths: ["M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z", "M9 12l2 2 4-4"]
  }
];

const SERVICIOS = [
  {
    titulo: "Gestión de bajas",
    texto: "Gestionamos bajas por destrucción total, con recupero de piezas y robos.",
    paths: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5M9 14l2 2 4-4"]
  },
  {
    titulo: "Asesoramiento y contención",
    texto:
      "Acompañamos y asesoramos, manteniendo informadas a todas las partes sobre el estado del trámite en forma permanente.",
    paths: ["M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z", "M8.5 12h.01M12 12h.01M15.5 12h.01"]
  },
  {
    titulo: "Desarmaderos de todo el país",
    texto:
      "Hacemos el seguimiento de las bajas a través de desarmaderos de todo el país, gestionando de forma centralizada el paso a paso de cada caso.",
    paths: ["M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z", "M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"]
  },
  {
    titulo: "Responsabilidad y respuesta",
    texto:
      "Nos hacemos cargo de cada trámite y respondemos a los asegurados, a los productores y al personal de la compañía.",
    paths: ["M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z", "M9 12l2 2 4-4"]
  },
  {
    titulo: "Toda la experiencia en una empresa",
    texto: "Aglutinamos la experiencia del servicio en una empresa propia, para una atención unificada de punta a punta.",
    paths: ["M3 21h18M5 21V8l7-5 7 5v13", "M9 21v-6h6v6"]
  }
];

const PORTAL = [
  "Estado actualizado de cada siniestro de tu compañía.",
  "Seguimiento permanente de cada trámite.",
  "Documentación del caso disponible para consultar.",
  "Vencimientos y próximos pasos a la vista."
];

const DATOS = [
  {
    rotulo: "WhatsApp comercial",
    valor: WHATSAPP_VISIBLE,
    paths: [
      "M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z",
      "M9.5 9c.4 2 2.5 4.3 5 5l1.2-1.2-1.9-1-.8.8c-.8-.4-1.5-1.1-1.9-1.9l.8-.8-1-1.9z"
    ]
  },
  {
    rotulo: "Email",
    valor: EMAIL_CONTACTO,
    href: `mailto:${EMAIL_CONTACTO}`,
    ancho: true,
    paths: ["M4 6h16v12H4z", "M4 7l8 6 8-6"]
  },
  {
    rotulo: "Horario de atención",
    valor: HORARIO_ATENCION,
    paths: ["M12 7v5l3 2", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"]
  },
  {
    rotulo: "Zona de trabajo",
    valor: ZONA_DE_TRABAJO,
    paths: ["M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z", "M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"]
  }
];

const BTN =
  "inline-flex items-center justify-center gap-2.5 min-h-[48px] px-[22px] rounded-md font-semibold text-[15px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-300";
const BTN_WA = `${BTN} bg-[#0f7a45] text-white shadow-[0_2px_6px_rgba(15,122,69,0.35)] hover:bg-[#0b6538]`;
const BTN_LINEA_CLARA = `${BTN} border border-brand-600 text-brand-900 hover:bg-brand-100`;
const BTN_LINEA_OSCURA = `${BTN} border border-brand-400 text-white hover:border-white`;
const CONTENEDOR = "mx-auto max-w-[1200px] px-4 md:px-8";
const EYEBROW = "text-[13px] font-semibold uppercase tracking-[0.14em]";

export default function Portada() {
  return (
    <div className="bg-[#f3f2f2] text-brand-900 font-sans">
      {/* Barra superior: misma que la de la plataforma */}
      <header className="bg-brand-900">
        <div className="mx-auto max-w-[1440px] px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <a href="#inicio" aria-label="Oltra Bajas, ir al inicio" className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/logo-oltra.jpg"
              alt="Oltra Gestión Integral"
              width={40}
              height={40}
              className="h-10 w-10 rounded-md shrink-0 mix-blend-screen"
              priority
            />
            <span className="hidden sm:flex flex-col leading-tight">
              <span className="font-heading font-semibold text-white tracking-tight text-lg">
                Oltra <span className="text-accent-300">Bajas</span>
              </span>
              <span className="text-[11px] text-silver-400 tracking-wide">Gestión Integral Automotor</span>
            </span>
          </a>
          <nav className="hidden md:flex gap-6 text-sm" aria-label="Secciones">
            {[
              ["#servicios", "Servicios"],
              ["#portal", "Portal"],
              ["#contacto", "Contacto"]
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="font-heading font-semibold text-silver-300 hover:text-white transition-colors pb-1 border-b border-transparent hover:border-accent-300"
              >
                {label}
              </a>
            ))}
          </nav>
          <Link href="/login" className={`${BTN_LINEA_OSCURA} min-h-[44px]`}>
            Ingresar
          </Link>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-accent-600 via-accent-400 to-silver-300" />
      </header>

      {/* Inicio */}
      <section id="inicio">
        <div className="mx-auto max-w-[960px] px-4 md:px-8 py-14 md:py-28 flex flex-col items-center text-center gap-7">
          <span className={`${EYEBROW} text-accent-700`}>Gestión Integral Automotor</span>
          <h1 className="font-heading font-bold text-[clamp(34px,5.2vw,58px)] leading-[1.12]">
            Menos trámites para vos, más respuestas para todos.
          </h1>
          <p className="text-[clamp(18px,2vw,21px)] leading-relaxed text-brand-700 max-w-[720px]">
            Nos ocupamos de todo el trámite y te mantenemos informado en cada paso. Prioridad absoluta en el servicio a asegurados, productores y compañías de seguros.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-1">
            <a
              href={whatsappUrl("Hola Oltra, quiero hacer una consulta")}
              className={`${BTN_WA} min-h-[52px] px-[26px] text-base`}
            >
              <IconoWhatsApp size={26} />
              Consultá ahora por WhatsApp
            </a>
            <a href="#servicios" className={`${BTN_LINEA_CLARA} min-h-[52px] px-[26px] text-base`}>
              Ver servicios
            </a>
          </div>
          <ul className="flex flex-wrap justify-center gap-3 mt-5">
            {DESTINATARIOS.map((d) => (
              <li
                key={d.texto}
                className="inline-flex items-center gap-2.5 bg-white border border-brand-200 rounded-full py-2.5 pl-3.5 pr-5 text-[15px] font-medium"
              >
                <span className="h-7 w-7 rounded-full bg-brand-900 flex items-center justify-center text-accent-400">
                  <Icono paths={d.paths} size={16} />
                </span>
                {d.texto}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Servicios */}
      <section id="servicios">
        <div className={`${CONTENEDOR} py-16 md:py-[88px] flex flex-col gap-10`}>
          <div className="flex flex-col gap-3 max-w-[680px]">
            <span className={`${EYEBROW} text-accent-700`}>Nuestro servicio</span>
            <h2 className="font-heading font-bold text-[clamp(26px,3.4vw,38px)] leading-[1.15]">
              Servicio completo para asegurados, productores y compañías.
            </h2>
            <p className="text-[17px] leading-relaxed text-brand-700">
              Nos ocupamos de la baja registral del vehículo siniestrado y acompañamos a todas las partes, con
              respuesta en cada trámite.
            </p>
          </div>
          <div className="flex flex-wrap gap-5">
            {SERVICIOS.map((s) => (
              <article
                key={s.titulo}
                className="flex-1 basis-[340px] min-w-0 bg-white border border-brand-200 rounded-lg p-7 flex flex-col gap-3.5 hover:border-accent-600 transition-colors"
              >
                <span className="h-12 w-12 rounded-lg bg-brand-900 flex items-center justify-center text-accent-400">
                  <Icono paths={s.paths} />
                </span>
                <h3 className="font-heading font-semibold text-[19px]">{s.titulo}</h3>
                <p className="text-[15px] leading-relaxed text-brand-700">{s.texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Portal para compañías */}
      <section id="portal" className="bg-white">
        <div className={`${CONTENEDOR} py-16 md:py-[88px]`}>
          <div className="max-w-[760px] flex flex-col gap-5">
            <span className={`${EYEBROW} text-accent-700`}>Portal para compañías</span>
            <h2 className="font-heading font-bold text-[clamp(26px,3.4vw,38px)] leading-[1.15]">
              Mirá el estado de cada caso sin tener que preguntar.
            </h2>
            <p className="text-[17px] leading-relaxed text-brand-700">
              Si ya trabajás con nosotros, ingresá a la plataforma para seguir tus siniestros en tiempo real.
            </p>
            <ul className="flex flex-col gap-3">
              {PORTAL.map((texto) => (
                <li key={texto} className="flex items-start gap-3 text-base leading-normal">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="shrink-0 mt-px text-accent-700"
                  >
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                  <span>{texto}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
              <Link href="/login" className={`${BTN} bg-brand-900 text-white hover:bg-brand-800 min-h-[52px] px-7`}>
                Ingresar a la plataforma
              </Link>
              <a
                href={whatsappUrl("Hola Oltra, quiero solicitar un usuario para la plataforma")}
                className="self-center text-sm text-accent-700 underline py-3"
              >
                ¿Todavía no tenés usuario? Pedilo por WhatsApp.
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section id="contacto" className="bg-brand-900 text-white">
        <div className={`${CONTENEDOR} py-16 md:py-[88px] flex flex-col gap-10`}>
          <div className="flex flex-col gap-3 max-w-[680px]">
            <span className={`${EYEBROW} text-accent-400`}>Contacto</span>
            <h2 className="font-heading font-bold text-[clamp(26px,3.4vw,38px)] leading-[1.15] text-white">
              Escribinos y te respondemos.
            </h2>
            <p className="text-[17px] leading-relaxed text-brand-200">
              Elegí la opción que mejor te describe y llegás directo a nuestro equipo.
            </p>
          </div>
          <div className="flex flex-wrap gap-5">
            <TarjetaContacto
              titulo="Soy una compañía de seguros"
              texto="Consultá por el servicio, pedí una propuesta o sumá tu compañía. Hablás con el área comercial."
            >
              <a
                href={whatsappUrl("Hola Oltra, somos una compañía de seguros y queremos consultar por el servicio")}
                className={`${BTN_WA} self-start mt-1`}
              >
                <IconoWhatsApp size={22} />
                WhatsApp comercial
              </a>
            </TarjetaContacto>
            <TarjetaContacto
              titulo="Soy productor"
              texto="Si tenés un cliente con un siniestro de pérdida total, consultanos y te asesoramos para resolver la baja con la información al día."
            >
              <a
                href={whatsappUrl("Hola Oltra, soy productor y quiero consultar por una baja por siniestro")}
                className={`${BTN_LINEA_OSCURA} self-start mt-1`}
              >
                Consultar como productor
              </a>
            </TarjetaContacto>
            <TarjetaContacto
              titulo="Soy asegurado o titular"
              texto="Si tu compañía nos derivó la baja de tu vehículo, escribinos con tu número de siniestro y te ayudamos con el trámite."
            >
              <a
                href={whatsappUrl("Hola Oltra, mi compañía me derivó la baja de mi vehículo. Mi número de siniestro es: ")}
                className={`${BTN_LINEA_OSCURA} self-start mt-1`}
              >
                Consultar por mi baja
              </a>
            </TarjetaContacto>
          </div>
          <dl className="flex flex-wrap gap-8 border-t border-white/15 pt-7">
            {DATOS.map((d) => (
              <div
                key={d.rotulo}
                className={`min-w-0 flex items-start gap-3.5 ${d.ancho ? "flex-[2_1_340px]" : "flex-1 basis-[220px]"}`}
              >
                <Icono paths={d.paths} size={22} className="shrink-0 mt-0.5 text-accent-400" />
                <div className="flex flex-col gap-1 min-w-0">
                  <dt className="text-[13px] text-brand-300">{d.rotulo}</dt>
                  <dd className="text-[15px] break-words">
                    {d.href ? (
                      <a href={d.href} className="hover:text-accent-300 transition-colors">
                        {d.valor}
                      </a>
                    ) : (
                      d.valor
                    )}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="bg-brand-900 border-t border-white/10">
        <div className="mx-auto max-w-[1200px] px-4 md:px-8 py-7 flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm text-brand-300">© Oltra — Gestión Integral Automotor</span>
          <div className="flex flex-wrap gap-6 text-sm">
            <Link href="/login" className="text-brand-200 hover:text-white py-2.5">
              Ingresar
            </Link>
            <a href="#contacto" className="text-brand-200 hover:text-white py-2.5">
              Contacto
            </a>
            <Link href="/privacidad" className="text-brand-200 hover:text-white py-2.5">
              Política de privacidad
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TarjetaContacto({
  titulo,
  texto,
  children
}: {
  titulo: string;
  texto: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 basis-[300px] min-w-0 bg-brand-800 border border-white/15 rounded-[10px] p-8 flex flex-col gap-4">
      <h3 className="font-heading font-semibold text-xl text-white">{titulo}</h3>
      <p className="text-[15px] leading-relaxed text-brand-200">{texto}</p>
      {children}
    </div>
  );
}
