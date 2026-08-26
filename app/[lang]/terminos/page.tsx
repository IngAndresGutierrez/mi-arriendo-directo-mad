import type { Metadata } from "next";
import { LocaleLink as Link } from "@/shared/i18n/locale-link";

import { LegalChrome } from "@/app/[lang]/legal-chrome";
import { LegalDocument, LegalList, LegalSection } from "@/features/legal";
import { PRIVACY_ROUTE, SUPPORT_ROUTE } from "@/shared/auth/routes";
import { NewTabLink } from "@/shared/ui/new-tab-link";
import { CONTROLLER_NAME } from "@/shared/legal/controller";
import { LEGAL_DOCUMENTS } from "@/shared/legal/documents";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Qué es y qué no es miarriendoDIRECTO.com, qué hace cada parte, y las reglas del arriendo directo entre propietario e inquilino.",
};

const document = LEGAL_DOCUMENTS.terms;

/**
 * The contract between this product and whoever uses it.
 *
 * **Most of it is about what this product is not**, and that is the point. Everything below is
 * already true of the code — it does not sell insurance, it does not move the money, it does not
 * adjudicate who pays for a repair — and the harm of not writing it down is that somebody assumes
 * the opposite at the moment it matters. The clause about deposits is the clearest case: Ley 820
 * forbids them, this product has no deposit stage and never will, and a landlord who does not know
 * that is a landlord who asks for one over WhatsApp.
 */
export default function TermsPage() {
  return (
    <LegalChrome>
      <LegalDocument
        title="Términos y condiciones"
        intro={`Estas son las condiciones de uso de miarriendoDIRECTO.com. Al crear una cuenta las aceptas, y con ellas el papel que ${CONTROLLER_NAME} tiene y el que no tiene en tu arriendo.`}
        version={document.version}
        effectiveDate={document.effectiveDate}
      >
        <LegalSection id="que-es" heading="1. Qué es esta plataforma">
          <p>
            miarriendoDIRECTO.com conecta propietarios e inquilinos para que arrienden{" "}
            <strong>directamente</strong>, sin intermediario. Lo que hacemos es sostener el proceso:
            publicar el inmueble, recibir la postulación, guardar los documentos, dejar constancia
            de la firma y llevar el registro de los pagos y de las incidencias.
          </p>
        </LegalSection>

        <LegalSection id="que-no-es" heading="2. Qué NO es, y esto importa">
          <LegalList>
            <li>
              <strong className="font-medium text-foreground">No somos inmobiliaria ni corredor.</strong>{" "}
              No representamos a ninguna de las dos partes, no cobramos comisión sobre el canon y no
              opinamos sobre a quién arrendar.
            </li>
            <li>
              <strong className="font-medium text-foreground">No vendemos seguros.</strong> La
              póliza de arrendamiento se compra en el sitio de Sura, con Sura, y no recibimos nada
              por señalarla. Tampoco somos parte de ese contrato ni respondemos por lo que la
              aseguradora decida.
            </li>
            <li>
              <strong className="font-medium text-foreground">No movemos el dinero.</strong> El
              inquilino transfiere desde su propio banco a la cuenta que el propietario indique, y
              el propietario confirma que llegó. Nunca custodiamos ni recibimos el canon: hacerlo
              nos convertiría en una entidad de pagos, y no lo somos.
            </li>
            <li>
              <strong className="font-medium text-foreground">
                No verificamos la identidad ni la solvencia de nadie.
              </strong>{" "}
              Guardamos lo que cada parte declara y sube. Quien decide es la otra parte.
            </li>
            <li>
              <strong className="font-medium text-foreground">No arbitramos.</strong> Si ustedes no
              están de acuerdo en quién debe pagar una reparación, el hilo de la incidencia guarda
              la discusión; ningún botón la resuelve.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection id="cuenta" heading="3. Tu cuenta">
          <p>
            Necesitas al menos 18 años, un correo al que tengas acceso y datos verdaderos. Eres
            responsable de lo que pase con tu cuenta y de mantener tu contraseña a salvo. Cada
            cuenta empieza como inquilino; publicar un inmueble es lo que la habilita como
            propietario.
          </p>
        </LegalSection>

        <LegalSection id="propietario" heading="4. Si publicas un inmueble">
          <p>
            Declaras que eres el propietario o que estás autorizado para arrendarlo, y que lo que
            publicas es cierto. Te pedimos la <strong>matrícula inmobiliaria</strong> y la dirección
            exacta, y ninguna de las dos se publica: con la matrícula cualquiera puede pedir el
            certificado de tradición y leer la dirección en él. Del inmueble se muestra el barrio,
            la ciudad y —si la marcas— una zona aproximada en el mapa, nunca un punto exacto.
          </p>
          <p>
            No verificamos la matrícula contra el registro. La validamos de forma laxa porque el
            único control real sería consultar la Oficina de Registro, y este producto no lo hace.
          </p>
        </LegalSection>

        <LegalSection id="proceso" heading="5. El proceso de arriendo">
          <p>
            Un proceso avanza <strong>etapa por etapa, y siempre porque el propietario lo mueve</strong>:
            cada paso es una decisión que alguien toma fuera de la plataforma y aquí se registra.
            Nada avanza solo. La única excepción es el final: confirmar el primer canon cierra el
            proceso y abre el arriendo en el mismo movimiento, porque es la misma decisión.
          </p>
          <LegalList>
            <li>
              El propietario puede rechazar una postulación en cualquier etapa, con un motivo que el
              inquilino lee. Un rechazo es definitivo.
            </li>
            <li>
              El inquilino puede retirarse en cualquier momento, y puede volver a postularse después:
              retirarse es usar un botón que le dimos, no un motivo para castigarlo.
            </li>
            <li>
              Consultar antecedentes requiere la <strong>autorización expresa</strong> del inquilino,
              que se pide por proceso y queda fechada. Un hallazgo no bloquea nada: la decisión es
              del propietario. Lo que sí bloquea es no haber consultado.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection id="firma" heading="6. La firma electrónica">
          <p>
            El contrato se firma aquí, con un código de un solo uso enviado al canal que cada parte
            ya verificó, y con una firma dibujada que se estampa en el documento. Nadie tiene que
            crear una cuenta en otro sitio.
          </p>
          <p>
            El marco es la Ley 527 de 1999 y el Decreto 2364 de 2012: una firma electrónica es
            confiable cuando los datos de creación pertenecen exclusivamente al firmante y cualquier
            alteración posterior es detectable, y cuando el método es acordado entre las partes hay
            una presunción a su favor. Cada firma queda atada al{" "}
            <strong>hash del archivo exacto</strong> que se firmó, de modo que reemplazar el
            contrato invalida las firmas por sí solo. Guardamos la fecha, la IP, el navegador y el
            canal enmascarado, y <strong>ambas partes los leen</strong>.
          </p>
          <p>
            No es una <em>firma digital</em> con certificado acreditado por la ONAC, que tiene una
            presunción legal más fuerte. La diferencia es de peso probatorio, no de validez. Y según
            el artículo 3 de la Ley 820 de 2003 el arriendo de vivienda urbana puede ser verbal o
            escrito: la firma es prueba, no requisito de validez.
          </p>
        </LegalSection>

        <LegalSection id="deposito" heading="7. No hay depósito, y no puede haberlo">
          <p>
            <strong className="font-medium text-foreground">
              La Ley 820 de 2003 prohíbe exigir depósitos en dinero para garantizar el cumplimiento
              de un contrato de arrendamiento de vivienda urbana
            </strong>{" "}
            (artículo 16). Esta plataforma no tiene ni tendrá una etapa de depósito. Lo que ocupa su
            lugar es la garantía: una póliza de arrendamiento o, si las partes lo deciden, ninguna.
          </p>
          <p>
            La póliza es <strong>opcional</strong>: nada en la ley colombiana la exige. Si el
            propietario la declina, no hay nada respaldando el arriendo, y así se lo decimos a las
            dos partes.
          </p>
        </LegalSection>

        <LegalSection id="pagos" heading="8. Los pagos del arriendo">
          <p>
            Cada mes, el propietario indica dónde recibir el canon, el inquilino transfiere y sube el
            comprobante, y el propietario confirma que llegó. Si el dinero llegó o no es algo que
            solo puede decir la persona dueña de la cuenta, y ningún pantallazo lo sustituye.
          </p>
          <p>
            El canon lo gobierna el contrato que ustedes firmaron. Esta plataforma no lo lee ni lo
            calcula: la cifra que aparece es la del proceso, y lo que se registra es lo que el
            inquilino declara haber transferido y lo que el propietario confirma.
          </p>
          <p>
            Tampoco terminamos un arriendo. La Ley 820 lo prorroga por un término igual salvo que
            una parte dé el aviso en la forma y el plazo que la ley señala, así que “se cumplieron
            los meses” no es “se terminó”.
          </p>
        </LegalSection>

        <LegalSection id="conducta" heading="9. Lo que no puedes hacer aquí">
          <LegalList>
            <li>Publicar inmuebles que no existen, que no son tuyos o con información falsa.</li>
            <li>Suplantar a otra persona o subir documentos que no son tuyos.</li>
            <li>
              Usar los datos de la otra parte para algo distinto del arriendo. Los datos de un
              inquilino que se postuló a tu inmueble no son una base de datos tuya.
            </li>
            <li>Discriminar en los términos que prohíbe la Constitución y la ley.</li>
            <li>Raspar el catálogo de forma automatizada ni intentar romper la plataforma.</li>
          </LegalList>
          <p>
            Podemos suspender o cerrar una cuenta que incumpla esto. Cuando haya un arriendo o un
            contrato firmado de por medio, cerrar la cuenta no borra el registro de lo acordado: la{" "}
            <NewTabLink href={PRIVACY_ROUTE} className="underline underline-offset-2">
              política de tratamiento de datos
            </NewTabLink>{" "}
            explica qué se conserva y por qué.
          </p>
        </LegalSection>

        <LegalSection id="disponibilidad" heading="10. Disponibilidad y responsabilidad">
          <p>
            Hacemos lo razonable para que la plataforma funcione, y no garantizamos que esté
            disponible sin interrupciones. No respondemos por el incumplimiento de ninguna de las
            partes del arriendo, ni por lo que decida una aseguradora, ni por un pago hecho a una
            cuenta equivocada: verifica siempre el nombre del titular antes de transferir, que es
            justamente por lo que la pantalla lo muestra.
          </p>
          <p>Nada de esto limita los derechos que la ley colombiana te reconoce como consumidor.</p>
        </LegalSection>

        <LegalSection id="datos" heading="11. Tus datos personales">
          <p>
            Todo lo relativo a datos personales —qué recogemos, para qué, con quién lo compartimos y
            cómo ejercer tus derechos— está en la{" "}
            <NewTabLink href={PRIVACY_ROUTE} className="underline underline-offset-2">
              Política de tratamiento de datos personales
            </NewTabLink>
            , que hace parte de estos términos.
          </p>
        </LegalSection>

        <LegalSection id="ley" heading="12. Ley aplicable, cambios y contacto">
          <p>
            Se aplican las leyes de la República de Colombia. Si cambiamos estos términos, la
            versión sube y la fecha nueva aparece arriba; cuando el cambio sea sustancial te lo
            avisaremos. Para cualquier cosa, escríbenos desde{" "}
            <Link href={SUPPORT_ROUTE} className="underline underline-offset-2">
              Soporte
            </Link>
            .
          </p>
        </LegalSection>
      </LegalDocument>
    </LegalChrome>
  );
}
