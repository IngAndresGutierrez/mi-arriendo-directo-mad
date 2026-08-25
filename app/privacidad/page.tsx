import type { Metadata } from "next";

import { LegalChrome } from "@/app/legal-chrome";
import { LegalDocument, LegalList, LegalSection } from "@/features/legal";
import { MIN_AGE } from "@/features/profile";
import { COOKIES_ROUTE, TERMS_ROUTE } from "@/shared/auth/routes";
import { NewTabLink } from "@/shared/ui/new-tab-link";
import { CONTROLLER_NAME, PRIVACY_CONTACT_EMAIL } from "@/shared/legal/controller";
import { LEGAL_DOCUMENTS } from "@/shared/legal/documents";

export const metadata: Metadata = {
  title: "Política de tratamiento de datos personales",
  description:
    "Qué datos personales trata miarriendoDIRECTO.com, para qué, con quién los comparte y cómo ejercer tus derechos como titular.",
};

const document = LEGAL_DOCUMENTS.privacy;

/**
 * The política de tratamiento required by Ley 1581 de 2012, art. 17 lit. k, whose minimum content
 * is set out in Decreto 1074 de 2015, art. 2.2.2.25.3.1.
 *
 * Every clause below is one of the items that article lists, in its order. What it is deliberately
 * **not** is a template: the finalidades name the actual screens, the encargados are the four
 * services this product really calls, and the security measures are the ones the code really
 * implements — which is why the coordinate-blunting and the `private/location` split are named. A
 * policy that describes a product other than the one deployed is worse than none, because it is
 * evidence of what we said we would do.
 */
export default function PrivacyPage() {
  return (
    <LegalChrome>
      <LegalDocument
        title="Política de tratamiento de datos personales"
        intro={`Esta política explica qué datos personales recoge ${CONTROLLER_NAME}, para qué los usa, con quién los comparte y cómo puedes ejercer tus derechos. Se aplica a todo lo que pasa en miarriendoDIRECTO.com.`}
        version={document.version}
        effectiveDate={document.effectiveDate}
      >
        <LegalSection id="marco" heading="1. Marco legal">
          <p>
            Tratamos tus datos personales conforme a la Ley Estatutaria 1581 de 2012, al Decreto
            1074 de 2015 —que compiló el Decreto 1377 de 2013— y a las demás normas colombianas
            sobre protección de datos personales. La autoridad de vigilancia es la
            Superintendencia de Industria y Comercio.
          </p>
        </LegalSection>

        <LegalSection id="datos" heading="2. Qué datos tratamos">
          <p>
            Solo lo que el producto necesita para funcionar, y en el momento en que lo necesita. No
            recogemos datos “por si acaso”.
          </p>
          <LegalList>
            <li>
              <strong className="font-medium text-foreground">De tu cuenta:</strong> correo
              electrónico, nombre completo, teléfono, dirección de residencia y fecha de nacimiento.
            </li>
            <li>
              <strong className="font-medium text-foreground">De tu perfil de inquilino:</strong>{" "}
              tipo y número de documento, ocupación, empleador o actividad, ingresos mensuales
              declarados, número de personas que vivirían en el inmueble, si tienes mascotas, y el
              nombre, teléfono y relación de una persona que te sirva de referencia.
            </li>
            <li>
              <strong className="font-medium text-foreground">Documentos que subes:</strong> tu
              documento de identidad, certificados laborales, desprendibles de pago, extractos
              bancarios, RUT, cámara de comercio o certificados de estudio o pensión, según tu
              ocupación.
            </li>
            <li>
              <strong className="font-medium text-foreground">De tus antecedentes:</strong> el
              resultado de las consultas que un propietario haga en fuentes públicas, con la nota
              que escriba. Solo con tu autorización expresa, y esa autorización se pide aparte, en
              cada proceso.
            </li>
            <li>
              <strong className="font-medium text-foreground">Si publicas un inmueble:</strong> su
              dirección exacta, su matrícula inmobiliaria y, si la marcas, su ubicación precisa en
              el mapa.
            </li>
            <li>
              <strong className="font-medium text-foreground">De la firma y los pagos:</strong> la
              fecha y hora de cada firma, tu dirección IP, tu navegador, el canal al que enviamos
              el código, los datos de la cuenta donde recibes el canon y los comprobantes de pago
              que subas.
            </li>
            <li>
              <strong className="font-medium text-foreground">De navegación:</strong> lo que dicen
              las cookies, explicado en la{" "}
              <NewTabLink href={COOKIES_ROUTE} className="underline underline-offset-2">
                política de cookies
              </NewTabLink>
              .
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection id="sensibles" heading="3. Datos sensibles">
          <p>
            El único dato sensible que te pedimos es el <strong>género</strong>, y{" "}
            <strong className="font-medium text-foreground">
              no estás obligado a darlo: el campo es opcional y puedes dejarlo en blanco
            </strong>
            . Si no lo respondes, el campo no se guarda. Puedes borrarlo después desde tu perfil, y
            hacerlo lo elimina de nuestra base.
          </p>
          <p>
            Las fotos de tu documento de identidad se tratan como datos personales, no como datos
            biométricos: no las procesamos con ningún sistema de reconocimiento facial ni las
            comparamos con tu rostro. Si algún día lo hiciéramos, te lo pediríamos aparte y con
            autorización explícita.
          </p>
        </LegalSection>

        <LegalSection id="finalidades" heading="4. Para qué usamos tus datos">
          <LegalList>
            <li>Crear tu cuenta, identificarte y permitirte entrar.</li>
            <li>
              Publicar inmuebles y mostrarlos en el catálogo público. Del inmueble se publica el
              barrio y la ciudad, nunca la dirección ni la matrícula inmobiliaria.
            </li>
            <li>
              Permitirle a un propietario evaluar tu postulación: el dossier que declaraste y los
              documentos que subiste.
            </li>
            <li>
              Consultar tus antecedentes judiciales, multas de tránsito y sanciones
              disciplinarias en fuentes públicas —solo con tu autorización expresa y por proceso— y
              guardar el resultado para que ambas partes lo lean.
            </li>
            <li>Coordinar la entrevista y recordártela.</li>
            <li>
              Dejar constancia de la firma electrónica del contrato y de que fuiste tú quien firmó.
            </li>
            <li>
              Llevar el registro de los pagos del arriendo y de las incidencias que reportes.
            </li>
            <li>Avisarte por correo, por la campana del producto y por WhatsApp cuando algo pasa.</li>
            <li>Atender tus solicitudes de soporte y las de tus derechos como titular.</li>
            <li>Cumplir obligaciones legales, contables y tributarias.</li>
          </LegalList>
          <p>
            No vendemos tus datos, no los usamos para publicidad de terceros y no tomamos
            decisiones automatizadas sobre tu postulación: quien decide es el propietario. Un
            hallazgo en tus antecedentes no bloquea nada por sí solo.
          </p>
        </LegalSection>

        <LegalSection id="encargados" heading="5. Con quién los compartimos">
          <p>
            Con la otra parte del arriendo, que es el punto del producto: si te postulas, el
            propietario recibe una copia de tu dossier y de tus documentos. Nadie más los ve.
          </p>
          {/*
            El colaborador. Es una **categoría nueva de destinatario** y por eso está aquí y no en
            la lista de encargados: no es un proveedor nuestro, es una persona que el propietario
            designa. Se dice exactamente qué recibe y qué no, porque el alcance es la única cosa que
            hace que esto no sea "el propietario le pasa tus datos a alguien".
          */}
          <p>
            Un propietario puede pedirle a otra persona que muestre su inmueble por él —un familiar,
            un portero, alguien que vive en la ciudad—. Si esa persona acepta, y solo mientras el
            propietario mantenga ese permiso, recibe <strong>tu nombre y tu teléfono</strong> para
            poder encontrarse contigo, junto con el día y el lugar de la visita. No recibe tus
            documentos, ni tus ingresos, ni tus antecedentes, ni el contrato, ni nada del pago.
            Verás su nombre en la etapa de la visita antes de encontrarte con ella.
          </p>
          <p>
            Y con los proveedores que hacen funcionar la plataforma, que actúan como{" "}
            <strong>encargados</strong> y solo tratan los datos para prestarnos su servicio:
          </p>
          <LegalList>
            <li>
              <strong className="font-medium text-foreground">Google (Firebase):</strong>{" "}
              autenticación, base de datos, almacenamiento de archivos y analítica.
            </li>
            <li>
              <strong className="font-medium text-foreground">Vercel:</strong> alojamiento y
              ejecución de la aplicación.
            </li>
            <li>
              <strong className="font-medium text-foreground">Resend:</strong> envío de los correos
              del producto.
            </li>
            <li>
              <strong className="font-medium text-foreground">Meta (WhatsApp Business):</strong>{" "}
              recordatorios de entrevista y códigos de firma, cuando eliges ese canal.
            </li>
            <li>
              <strong className="font-medium text-foreground">OpenStreetMap:</strong> los mapas del
              catálogo. Tu navegador les pide las imágenes directamente, así que reciben tu
              dirección IP.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection id="transferencia" heading="6. Transferencia internacional">
          <p>
            Los proveedores anteriores están en Estados Unidos y en la Unión Europea, de modo que
            tus datos salen de Colombia. Estados Unidos fue declarado país con nivel adecuado de
            protección por la Circular Externa 005 de 2017 de la Superintendencia de Industria y
            Comercio, y la Unión Europea también lo es. Al autorizar el tratamiento de tus datos
            autorizas esa transferencia.
          </p>
        </LegalSection>

        <LegalSection id="terceros" heading="7. Datos de otras personas que tú nos das">
          <p>
            Si nos das los datos de otra persona —la referencia de tu perfil de inquilino, el
            titular de la cuenta donde recibes el canon, o alguien a quien invitas a mostrar tu
            inmueble— declaras que cuentas con su autorización para entregárnoslos y que le
            informaste para qué. Esa persona puede ejercir sus
            derechos ante nosotros por el mismo canal que tú.
          </p>
        </LegalSection>

        <LegalSection id="derechos" heading="8. Tus derechos, y cómo ejercerlos">
          <p>Como titular de tus datos personales puedes:</p>
          <LegalList>
            <li>Conocer, actualizar y rectificar tus datos.</li>
            <li>
              Solicitar prueba de la autorización que diste, salvo cuando la ley no la exija.
            </li>
            <li>Ser informado del uso que le hemos dado a tus datos.</li>
            <li>
              Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a
              la ley.
            </li>
            <li>
              Revocar la autorización o pedir la supresión de tus datos, cuando no exista un deber
              legal o contractual de conservarlos.
            </li>
            <li>Acceder gratuitamente a tus datos.</li>
          </LegalList>
          <p>
            <strong className="font-medium text-foreground">Puedes hacerlo tú mismo.</strong> En tu
            perfil hay un registro de qué autorizaste y cuándo, y un botón para eliminar tu cuenta.
            También puedes escribirnos a{" "}
            <a
              href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              {PRIVACY_CONTACT_EMAIL}
            </a>{" "}
            indicando tu nombre, cómo quieres que te contactemos y qué necesitas.
          </p>
          <p>
            <strong className="font-medium text-foreground">Plazos.</strong> Una{" "}
            <strong>consulta</strong> se responde en máximo diez días hábiles; si no alcanzamos, te
            lo decimos y usamos hasta cinco días hábiles más. Un <strong>reclamo</strong> se
            resuelve en máximo quince días hábiles; si no alcanzamos, te lo decimos y usamos hasta
            ocho días hábiles más. Son los plazos de los artículos 14 y 15 de la Ley 1581.
          </p>
        </LegalSection>

        <LegalSection id="supresion" heading="9. Qué pasa cuando pides que borremos tus datos">
          <p>
            Borramos tu cuenta, tu perfil, tu perfil de inquilino, los archivos que subiste, tus
            inmuebles y tus notificaciones.
          </p>
          <p>
            <strong className="font-medium text-foreground">
              Hay cosas que no podemos borrar, y es importante que lo sepas antes:
            </strong>{" "}
            los contratos que firmaste, el registro de las firmas, los arriendos que tuviste con
            sus meses y sus incidencias, y los procesos ya cerrados con lo que declaraste en cada
            uno. Un contrato es la prueba de un acuerdo entre dos personas: borrarlo eliminaría
            también la evidencia de la otra parte, que no autorizó eso. El artículo 9 de la Ley
            1581 y el artículo 2.2.2.25.2.11 del Decreto 1074 contemplan justamente este caso.
            Esos registros quedan asociados a un identificador, no a tu cuenta.
          </p>
          <p>
            Tampoco borramos el registro de las autorizaciones que diste: son la prueba de que el
            tratamiento que produjo esos contratos estaba autorizado. Guardan una versión, una
            fecha, una IP y un navegador; nunca guardaron tu nombre.
          </p>
          <p>
            Mientras tengas un proceso abierto o un arriendo en curso no podemos eliminar tu
            cuenta. Retira el proceso o espera a que se cierre.
          </p>
        </LegalSection>

        <LegalSection id="retencion" heading="10. Cuánto tiempo los guardamos">
          <p>
            Mientras tengas cuenta, y después de eso el tiempo que la ley nos obligue a conservar
            los registros de una relación contractual —cinco años para efectos contables y
            tributarios, contados desde el cierre— o el que necesitemos para atender una
            reclamación.
          </p>
        </LegalSection>

        <LegalSection id="seguridad" heading="11. Cómo los protegemos">
          <p>
            Además de cifrado en tránsito y control de acceso por reglas de seguridad, hay dos
            decisiones de diseño que vale la pena nombrar porque te protegen de verdad:
          </p>
          <LegalList>
            <li>
              <strong className="font-medium text-foreground">
                La dirección de un inmueble y su matrícula inmobiliaria no se publican nunca.
              </strong>{" "}
              Viven en un documento aparte que solo el propietario puede leer. Con la matrícula
              cualquiera puede pedir el certificado de tradición y leer la dirección en él.
            </li>
            <li>
              <strong className="font-medium text-foreground">
                El mapa público muestra un círculo, jamás un punto.
              </strong>{" "}
              Una coordenada con cinco decimales <em>es</em> la dirección. La que se publica está
              redondeada a una rejilla de unos 550 metros, así que quien mire aprende la zona y
              nada de lo que hay dentro.
            </li>
            <li>
              Tu perfil de inquilino solo lo puedes leer tú. Un propietario ve una copia
              únicamente cuando te postulas a su inmueble, y esa copia queda congelada en ese
              proceso.
            </li>
            <li>
              Los datos de la cuenta donde recibes el canon <strong>nunca</strong> viajan en un
              correo: el aviso dice que hay algo por pagar y la cuenta se lee en la página, detrás
              de tu sesión.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection id="menores" heading="12. Menores de edad">
          <p>
            El producto no está dirigido a menores de edad y no tratamos sus datos: para crear una
            cuenta hay que tener al menos {MIN_AGE} años, que es la edad para celebrar un contrato
            de arrendamiento en Colombia, y la fecha de nacimiento se valida contra el reloj del
            servidor.
          </p>
        </LegalSection>

        <LegalSection id="vigencia" heading="13. Vigencia y cambios">
          <p>
            Esta política está vigente desde la fecha indicada arriba y rige mientras tratemos tus
            datos. Si la cambiamos, la versión sube y la nueva fecha aparece en esta misma página.
            Cuando el cambio afecte las finalidades para las que usamos tus datos, te pediremos una
            autorización nueva: eso es lo que exige el artículo 2.2.2.25.2.5 del Decreto 1074.
          </p>
          <p>
            Las condiciones del servicio están en los{" "}
            <NewTabLink href={TERMS_ROUTE} className="underline underline-offset-2">
              Términos y condiciones
            </NewTabLink>
            .
          </p>
        </LegalSection>
      </LegalDocument>
    </LegalChrome>
  );
}
