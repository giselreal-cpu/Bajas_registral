export const metadata = {
  title: "Política de privacidad — Oltra Gestión Integral"
};

export default function PrivacidadPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 text-sm text-slate-700 leading-relaxed">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 mb-1">Política de privacidad</h1>
        <p className="text-slate-500">Oltra — Gestión Integral Automotor. Última actualización: septiembre de 2026.</p>
      </div>

      <section className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-slate-800">1. Quiénes somos y a qué se aplica esta política</h2>
        <p>
          Oltra — Gestión Integral Automotor ("Oltra", "nosotros") gestiona trámites de baja
          registral de vehículos siniestrados (pérdida total) por encargo de compañías
          aseguradoras. Esta política describe qué datos personales tratamos a través del sistema
          de gestión interno (la "Plataforma", accesible en este dominio) y de los enlaces
          públicos que la Plataforma genera para terceros que participan del trámite (gestores de
          campo, desarmaderos, grúas y personas que completan documentación).
        </p>
        <p>
          Tratamos los datos conforme a la <strong>Ley 25.326 de Protección de los Datos
          Personales</strong> de la República Argentina y su normativa complementaria, bajo el
          control de la Agencia de Acceso a la Información Pública (AAIP).
        </p>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-slate-800">2. Qué datos recopilamos</h2>
        <p><strong>a) Del equipo que usa la Plataforma</strong> (operadores, administradores y usuarios de las compañías aseguradoras clientas): nombre, correo electrónico, rol asignado y, si se ingresa con Google, el nombre y la foto de perfil que provee esa cuenta. No accedemos a otros datos de la cuenta de Google más allá de la identificación básica necesaria para iniciar sesión.</p>
        <p><strong>b) De los titulares/asegurados de los vehículos siniestrados</strong>, cargados por el equipo de Oltra a pedido de la compañía aseguradora para gestionar el trámite: nombre y apellido, DNI, teléfono, correo electrónico, y domicilio (dirección, entre calles, localidad, partido y provincia).</p>
        <p><strong>c) Del vehículo</strong>: dominio (patente), marca, modelo y año — no son datos personales en sí mismos, pero quedan asociados al titular.</p>
        <p><strong>d) De terceros que participan del trámite</strong> (gestores de campo, choferes/grúas, personas que completan el formulario de baja, desarmaderos): nombre y datos de contacto (teléfono, correo), estrictamente los necesarios para coordinar esa etapa puntual del trámite.</p>
        <p><strong>e) Documentación asociada al caso</strong>: fotos del vehículo/dominio, informes de dominio y de multas, formularios de baja y demás documentación que pueda contener datos personales del titular, cargada por el equipo o por los terceros mencionados en (d) a través de sus enlaces de acceso.</p>
        <p><strong>f) Datos de uso y auditoría</strong>: quién hizo cada cambio dentro de un caso y cuándo, con fines de trazabilidad interna del trámite.</p>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-slate-800">3. Para qué usamos estos datos</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Gestionar de punta a punta el trámite de baja registral del vehículo siniestrado.</li>
          <li>Contactar al titular del vehículo para coordinar los pasos del trámite (traslado, presentación de documentación, etc.).</li>
          <li>Coordinar con desarmaderos, registros automotores y gestores de campo lo que cada uno necesita para su parte del proceso.</li>
          <li>Generar la documentación propia del trámite (autorización de retiro y traslado, formulario de baja, comprobantes internos).</li>
          <li>Informar a la compañía aseguradora el estado de los casos que nos encargó.</li>
          <li>Llevar un registro interno de auditoría y, cuando corresponde, un control administrativo/contable de la operación (esto último es información interna de Oltra, no se comparte con terceros).</li>
        </ul>
        <p>No usamos estos datos con fines publicitarios ni los cedemos a terceros ajenos al trámite.</p>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-slate-800">4. Con quién compartimos los datos</h2>
        <p>Solo con quienes participan directamente del trámite del que se trate, y solo lo necesario para su parte:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>La compañía aseguradora que encargó el caso.</li>
          <li>El desarmadero asignado al vehículo.</li>
          <li>El registro automotor donde se presenta la baja.</li>
          <li>El gestor de campo, la grúa y/o la persona a cargo del formulario de baja asignados a ese caso puntual — cada uno recibe un enlace de acceso acotado solo a los datos que necesita para su tarea, no al caso completo.</li>
        </ul>
        <p>
          No vendemos ni cedemos datos personales a terceros con fines comerciales o
          publicitarios. La Plataforma se aloja en infraestructura de terceros proveedores de
          hosting y base de datos (Supabase y Vercel), que actúan como encargados del tratamiento
          bajo nuestras instrucciones y sus propias políticas de seguridad.
        </p>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-slate-800">5. Cómo protegemos los datos</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Acceso a la Plataforma restringido por usuario y contraseña (o inicio de sesión con Google), con roles que limitan qué puede ver y editar cada persona — por ejemplo, el usuario de una compañía aseguradora solo ve los casos de esa compañía, y nunca observaciones internas ni información financiera.</li>
          <li>Los enlaces de acceso para terceros externos (gestores, desarmaderos, grúas) son enlaces individuales y acotados: muestran solo el caso puntual y los datos estrictamente necesarios para esa tarea, se pueden invalidar y regenerar en cualquier momento.</li>
          <li>Los documentos (fotos, PDFs) se almacenan en un espacio privado; para verlos se generan enlaces de acceso temporales, no quedan expuestos públicamente.</li>
          <li>Registro de auditoría interno de los cambios realizados sobre cada caso.</li>
        </ul>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-slate-800">6. Cuánto tiempo conservamos los datos</h2>
        <p>
          Conservamos los datos del trámite mientras dure la relación comercial con la compañía
          aseguradora y mientras sea necesario para cumplir obligaciones legales, contables o
          impositivas aplicables. Pasado ese plazo, los datos se eliminan o se anonimizan.
        </p>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-slate-800">7. Derechos del titular de los datos</h2>
        <p>
          Conforme la Ley 25.326, el titular de los datos personales tiene derecho a acceder,
          rectificar, actualizar y, cuando corresponda, solicitar la supresión de sus datos
          personales. Para ejercer estos derechos, podés escribirnos a{" "}
          <a href="mailto:giselreal@gmail.com" className="text-brand-600 hover:underline">
            giselreal@gmail.com
          </a>
          . La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de
          la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan
          quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en
          materia de protección de datos personales.
        </p>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-slate-800">8. Inicio de sesión con Google</h2>
        <p>
          Si elegís iniciar sesión con Google, usamos ese inicio de sesión únicamente para
          identificarte dentro del equipo de Oltra (nombre, correo y foto de perfil básica) — no
          accedemos a tu contraseña de Google, ni a tu correo, contactos, archivos u otros datos
          de tu cuenta de Google más allá de esa identificación mínima.
        </p>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-heading font-semibold text-slate-800">9. Cambios a esta política</h2>
        <p>
          Podemos actualizar esta política si cambia la forma en que tratamos los datos. La fecha
          de la última actualización figura arriba de todo.
        </p>
      </section>

      <section className="card p-5 space-y-2">
        <h2 className="font-heading font-semibold text-slate-800">10. Contacto</h2>
        <p>
          Ante cualquier consulta sobre esta política o sobre el tratamiento de tus datos,
          escribinos a{" "}
          <a href="mailto:giselreal@gmail.com" className="text-brand-600 hover:underline">
            giselreal@gmail.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
