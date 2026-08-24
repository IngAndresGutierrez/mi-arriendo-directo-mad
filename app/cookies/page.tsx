import type { Metadata } from "next";
import Link from "next/link";

import { LegalChrome } from "@/app/legal-chrome";
import { CookiePreferences, LegalDocument, LegalList, LegalSection } from "@/features/legal";
import { PRIVACY_ROUTE } from "@/shared/auth/routes";
import { COOKIE_POLICY_EFFECTIVE_DATE, COOKIE_POLICY_VERSION } from "@/shared/legal/documents";

export const metadata: Metadata = {
  title: "Cookies",
  description:
    "Qué cookies usa miarriendoDIRECTO.com, para qué sirve cada una y cómo autorizar o retirar las de analítica.",
};

/**
 * The cookie policy, and the control that makes it mean something.
 *
 * **It names the four things this product actually stores in a browser**, with their real names and
 * lifetimes, rather than the four generic categories every policy on the internet lists. Two of
 * them are not even cookies — the bell's sound preference is `localStorage` — and saying so is the
 * difference between a policy and a template. Notably absent: any advertising cookie, because this
 * product serves no ads and claiming otherwise would be describing a processing that does not
 * happen.
 *
 * Colombia has no ePrivacy directive, and the temptation is to conclude nothing is required. The
 * SIC's position is the opposite: a cookie that identifies a browser is personal data, so the
 * general regime applies, and its Resolución 32126 de 2022 classifies cookies without exempting any
 * category from prior authorisation. What is genuinely exempt is what the service cannot work
 * without — which is why exactly one of the rows below has a switch.
 */
export default function CookiesPage() {
  return (
    <LegalChrome>
      <LegalDocument
        title="Cookies y datos de navegación"
        intro="Qué guardamos en tu navegador, para qué sirve cada cosa y qué puedes apagar. Solo hay una cosa opcional, y aquí mismo la decides."
        version={COOKIE_POLICY_VERSION}
        effectiveDate={COOKIE_POLICY_EFFECTIVE_DATE}
      >
        <LegalSection id="tu-decision" heading="1. Tu decisión">
          <p>
            Las cookies necesarias no se pueden apagar: sin ellas no hay sesión y el producto no
            funciona. La analítica sí, y esta es la misma decisión que tomaste en el aviso de abajo
            de la pantalla.
          </p>
          <CookiePreferences />
        </LegalSection>

        <LegalSection id="necesarias" heading="2. Necesarias">
          <p>Sin estas no hay producto. No se pueden desactivar y no requieren autorización.</p>
          <LegalList>
            <li>
              <strong className="font-medium text-foreground">
                <code>session</code>
              </strong>{" "}
              — mantiene tu sesión abierta. Dura 7 días, es <code>httpOnly</code> (el JavaScript de
              la página no puede leerla) y se borra al cerrar sesión.
            </li>
            <li>
              <strong className="font-medium text-foreground">
                <code>cookie-consent</code>
              </strong>{" "}
              — guarda esta misma decisión, para no volver a preguntártela. Dura un año. Es la
              única cookie cuya existencia se debe a que preguntamos.
            </li>
            <li>
              <strong className="font-medium text-foreground">
                <code>sidebar</code>
              </strong>{" "}
              — recuerda si dejaste el menú ancho o angosto. Dura un año y no identifica a nadie: es
              una cookie y no <code>localStorage</code> porque el menú se dibuja en el servidor, y
              si no lo supiera antes de pintar, la página abriría angosta y daría un salto.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection id="analitica" heading="3. Analítica (opcional)">
          <p>
            Usamos <strong>Google Analytics para Firebase</strong>, y solo si lo autorizas: mientras
            no lo hagas, la librería no se carga y no se envía nada. Nos dice qué páginas se usan,
            desde qué tipo de dispositivo y en qué ciudad, de forma agregada.
          </p>
          <p>
            <strong className="font-medium text-foreground">
              Nunca le mandamos datos personales como parámetros
            </strong>
            : ni tu correo, ni tu nombre, ni tu documento, ni tus ingresos. Solo identificadores que
            no dicen quién eres, como el tipo de inmueble o la ciudad de un anuncio.
          </p>
        </LegalSection>

        <LegalSection id="no-son-cookies" heading="4. Cosas que no son cookies pero se guardan igual">
          <LegalList>
            <li>
              <strong className="font-medium text-foreground">
                El sonido de las notificaciones
              </strong>{" "}
              se recuerda en <code>localStorage</code>. Es una preferencia de interfaz, no un dato
              personal, y nunca sale de tu navegador.
            </li>
            <li>
              <strong className="font-medium text-foreground">La sesión del SDK de Firebase</strong>{" "}
              vive en IndexedDB. Es la que permite que tu navegador suba una foto directamente al
              almacenamiento, y es distinta de la cookie <code>session</code>.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection id="terceros" heading="5. Terceros que ven tu navegación">
          <p>
            <strong className="font-medium text-foreground">Los mapas.</strong> En la ficha de un
            inmueble, tu navegador pide las imágenes del mapa a los servidores de OpenStreetMap, y
            por eso ellos reciben tu dirección IP. No ponen cookies nuestras y no les mandamos nada
            del inmueble ni de ti.
          </p>
          <p>
            <strong className="font-medium text-foreground">
              No hay cookies de publicidad, ni píxeles de redes sociales, ni remarketing.
            </strong>{" "}
            No porque estén apagados: porque no existen en este producto.
          </p>
        </LegalSection>

        <LegalSection id="como-cambiarlo" heading="6. Cómo cambiar de opinión">
          <p>
            Con el interruptor de arriba, en cualquier momento. También puedes borrar las cookies
            desde tu navegador; si borras <code>cookie-consent</code>, volveremos a preguntarte. Y si
            desactivas todas las cookies en el navegador, no podrás iniciar sesión: eso es lo que
            hace la cookie necesaria.
          </p>
          <p>
            El resto de lo que hacemos con tus datos está en la{" "}
            <Link href={PRIVACY_ROUTE} className="underline underline-offset-2">
              Política de tratamiento de datos personales
            </Link>
            .
          </p>
        </LegalSection>
      </LegalDocument>
    </LegalChrome>
  );
}
