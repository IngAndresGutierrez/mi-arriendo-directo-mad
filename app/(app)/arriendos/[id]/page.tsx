import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, MessageSquareIcon } from "lucide-react";

import {
  checkProgress,
  checksBlocker,
  checksBlockerMessage,
  guaranteeBlocker,
  guaranteeBlockerMessage,
  guaranteeState,
  GuaranteePanel,
  GUARANTEE_STATE_LABELS,
  ContractPanel,
  contractBlocker,
  contractBlockerMessage,
  contractState,
  withContractUrl,
  withStampedUrl,
  CONTRACT_STATE_LABELS,
  interviewBlocker,
  interviewBlockerMessage,
  interviewState,
  InterviewPanel,
  INTERVIEW_STATE_LABELS,
  closedAtLabel,
  stageIndex,
  getApplicationFor,
  BackgroundCheckPanel,
  DocumentReviewPanel,
  LiveApplication,
  touchApplicationDocuments,
  DossierSummary,
  StageActions,
  StageTimeline,
} from "@/features/application";
import {
  documentProgress,
  documentsBlocker,
  documentsBlockerMessage,
  listTenantDocuments,
  withSignedUrls,
  DocumentChecklist,
} from "@/features/tenant-profile";
import { getProfile, requireCompleteProfile } from "@/features/profile";
import { stageAnchor } from "@/features/notification";
import { getOwnedProperty, getPropertyLocation } from "@/features/property";
import { DOCUMENT_TYPE_LABELS } from "@/features/tenant-profile/client";
import { RENTALS_ROUTE, propertyDetailRoute } from "@/shared/auth/routes";
import { formatLongDate } from "@/shared/format/date";
import { formatCOP } from "@/shared/format/money";

export const metadata: Metadata = {
  title: "Proceso de arriendo",
};

export default async function ApplicationPage(props: PageProps<"/arriendos/[id]">) {
  const { id } = await props.params;
  const user = await requireCompleteProfile();

  // Membership is decided by the read: a stranger gets the same answer as a process that does
  // not exist, so the page cannot even confirm that this id is real.
  const application = await getApplicationFor(id, user.uid);
  if (!application) notFound();

  const isLandlord = application.landlordUid === user.uid;
  const closed = closedAtLabel(application);

  /*
   * The documents belong to the tenant, not to the application, and the bucket is private: what
   * either side gets is a link signed for the next hour. That is what lets the landlord read a
   * payslip without the file becoming permanently reachable by whoever the link is forwarded to.
   */
  const documents = await withSignedUrls(await listTenantDocuments(application.tenantUid));
  const progress = documentProgress(application.dossier.occupation, documents);

  /*
   * Why the process cannot move on, if it cannot. Worked out here because it needs both sides of
   * it — what was uploaded and what the landlord decided — and handed to the button as a
   * sentence: its job is to say the reason, not to work it out.
   */
  /*
   * A stage already behind us shows its panel without its buttons: the files and the verdicts
   * are the record, and a control that no longer changes anything is the same lie as a
   * "Continuar" that does not continue.
   */
  const past = (stage: Parameters<typeof stageIndex>[0]) =>
    stageIndex(application.stage) > stageIndex(stage) || application.status !== "open";

  const blocker =
    application.stage === "tenant_data"
      ? documentsBlocker(application.dossier.occupation, documents, application.documentReviews)
      : null;

  // The records stage has a gate of its own: nothing may be consulted without the tenant's
  // authorisation, and the process should not leave the stage with searches nobody ran.
  const checksLeft =
    application.stage === "background_check"
      ? checksBlocker(application.checksAuthorizedAt, application.checkResults)
      : null;

  // And the interview has three: a time proposed, the tenant's confirmation, and what came out
  // of the conversation. A stage that moves on without those is a stage nobody held.
  const interviewLeft =
    application.stage === "interview" ? interviewBlocker(application.interview) : null;

  // Y la garantía: sin póliza expedida no se firma, que es de lo que responde esta etapa.
  const guaranteeLeft =
    application.stage === "guarantee" ? guaranteeBlocker(application.guarantee) : null;

  /*
   * Lo que Sura pide, y solo para el propietario: el correo del inquilino y la matrícula. La
   * matrícula vive fuera del documento público a propósito — con ella cualquiera saca el
   * certificado de tradición y lee la dirección — así que se lee aquí, del dueño, y no se le
   * pasa nunca al inquilino.
   */
  /*
   * El contrato firmado, con un enlace válido una hora. Se lee siempre que exista y no solo en
   * su etapa: es el documento del arriendo y ambas partes van a volver a buscarlo después.
   */
  const [contract, stampedContract] = await Promise.all([
    withContractUrl(application.contract?.document ?? null),
    /*
     * El PDF derivado, con su propio enlace de una hora. Es lo que las partes descargan, así que se
     * lee siempre que exista y no solo en su etapa.
     */
    withStampedUrl(application.contract?.stamped ?? null),
  ]);
  const contractLeft =
    application.stage === "contract_signature" ? contractBlocker(application.contract) : null;

  const onGuarantee = isLandlord && application.stage === "guarantee";
  /*
   * El inmueble se lee además del anuncio congelado en la postulación porque el cotizador pide el
   * arriendo y la administración por separado — la postulación solo guarda el total — y pide el
   * departamento, que tampoco está ahí. Las tres lecturas van en paralelo: son independientes.
   */
  const [tenantAccount, location, property] = await Promise.all([
    onGuarantee ? getProfile(application.tenantUid) : null,
    onGuarantee ? getPropertyLocation(application.propertyId, user.uid) : null,
    onGuarantee ? getOwnedProperty(application.propertyId, user.uid) : null,
  ]);

  /*
   * La hoja de datos del cotizador, resuelta aquí: el panel es un Client Component y lo que
   * necesita son nueve valores, no dos objetos de dominio. El tipo de documento va ya como su
   * etiqueta en español para que el módulo de la postulación no tenga que importar el dominio del
   * perfil del inquilino solo para traducir una palabra.
   */
  const quote =
    onGuarantee && property
      ? {
          rent: property.rent,
          adminFee: property.adminFee,
          leaseMonths: application.leaseMonths,
          department: property.area.department,
          city: property.area.city,
          address: location?.line ?? "",
          tenantName: tenantAccount?.fullName ?? application.tenantName,
          tenantDocumentType: DOCUMENT_TYPE_LABELS[application.dossier.documentType],
          tenantDocumentNumber: application.dossier.documentNumber,
        }
      : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Both sides are often here at once: one uploading, the other approving. */}
      <LiveApplication applicationId={application.id} updatedAt={application.updatedAt} />

      <Link
        href={RENTALS_ROUTE}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Arriendos
      </Link>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-primary dark:text-foreground">
        {application.propertyTitle}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isLandlord
          ? `${application.tenantName || "Un inquilino"} se postuló · ${application.propertyCity}`
          : `Tu postulación · ${application.propertyCity}`}{" "}
        ·{" "}
        <Link href={propertyDetailRoute(application.propertySlug)} className="hover:underline">
          ver el anuncio
        </Link>
      </p>

      {closed ? (
        <p className="mt-4 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          {closed}
          {application.closingNote ? (
            <>
              {" — "}
              <span className="text-foreground">{application.closingNote}</span>
            </>
          ) : null}
        </p>
      ) : null}

      <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold text-primary dark:text-foreground">La postulación</h2>

        {/*
          Three facts with their names on them, under the heading. They used to be one line of
          small grey text to the right of the title — "$1.400.000 al mes · 1 año · desde el 31 de
          agosto" — where the reader had to work out which number was the rent, which was the term
          and what the date meant. These are the terms of a lease: they are what someone comes to
          this page to check.
        */}
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">
              Canon mensual
            </dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {formatCOP(application.monthlyCost)}
              <span className="font-normal text-muted-foreground"> al mes</span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              Duración del contrato
            </dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {application.leaseMonths === 6 ? "6 meses" : "1 año"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              {isLandlord ? "Se mudaría el" : "Te mudarías el"}
            </dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {formatLongDate(application.desiredMoveIn)}
            </dd>
          </div>
        </dl>

        {/*
          The identity document and the reference's phone are for the landlord alone. The
          tenant already knows them, and rendering them again is one more screen they could be
          standing in front of someone with.
        */}
        <DossierSummary
          dossier={application.dossier}
          monthlyCost={application.monthlyCost}
          showSensitive={isLandlord}
        />

        {application.message ? (
          <p className="flex items-start gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            <MessageSquareIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="text-foreground">{application.message}</span>
          </p>
        ) : null}
      </section>

      {/*
        The two stages that ask something of somebody live above the timeline, where whoever has
        to act will see them without scrolling past nine other steps.
      */}
      <div className="mt-6">
        <StageActions
          application={application}
          isLandlord={isLandlord}
          blockedBecause={
            blocker
              ? documentsBlockerMessage(blocker, isLandlord)
              : checksLeft
                ? checksBlockerMessage(checksLeft, isLandlord)
                : interviewLeft
                  ? interviewBlockerMessage(interviewLeft, isLandlord)
                  : guaranteeLeft
                    ? guaranteeBlockerMessage(guaranteeLeft, isLandlord)
                    : contractLeft
                      ? contractBlockerMessage(contractLeft, isLandlord)
                      : null
          }
          // The stage's own card, which is where its work lives.
          resolveAt={stageAnchor(application.stage)}
        />
      </div>

      <div className="mt-8">
        {/*
          The work of a stage goes inside the stage, folded. Built here because it needs both
          modules — the documents are the tenant profile's, the review is the application's — and
          the timeline should not have to know either.
        */}
        <StageTimeline
          application={application}
          isLandlord={isLandlord}
          work={{
            tenant_data: {
              title: isLandlord ? "Documentos del inquilino" : "Tus documentos",
              meta: `${progress.uploaded} de ${progress.required} subidos`,
              content: isLandlord ? (
                <DocumentReviewPanel
                  applicationId={application.id}
                  documents={documents}
                  reviews={application.documentReviews}
                  readOnly={past("tenant_data")}
                />
              ) : (
                <DocumentChecklist
                  occupation={application.dossier.occupation}
                  documents={documents}
                  reviews={application.documentReviews}
                  // Nudges the application so the landlord's screen learns a file arrived.
                  onChanged={touchApplicationDocuments.bind(null, application.id)}
                  readOnly={past("tenant_data")}
                />
              ),
            },
            interview: {
              title: "Entrevista con el propietario",
              meta: INTERVIEW_STATE_LABELS[interviewState(application.interview)],
              content: (
                <InterviewPanel
                  applicationId={application.id}
                  interview={application.interview}
                  isLandlord={isLandlord}
                  readOnly={past("interview")}
                />
              ),
            },
            guarantee: {
              title: "Póliza de arrendamiento",
              meta: GUARANTEE_STATE_LABELS[guaranteeState(application.guarantee)],
              content: (
                <GuaranteePanel
                  applicationId={application.id}
                  guarantee={application.guarantee}
                  isLandlord={isLandlord}
                  tenantEmail={tenantAccount?.email}
                  registryNumber={location?.registryNumber}
                  quote={quote}
                  readOnly={past("guarantee")}
                />
              ),
            },
            contract_signature: {
              title: "Firma del contrato",
              meta: CONTRACT_STATE_LABELS[contractState(application.contract)],
              content: (
                <ContractPanel
                  applicationId={application.id}
                  contract={application.contract}
                  document={contract}
                  stamped={stampedContract}
                  isLandlord={isLandlord}
                  readOnly={past("contract_signature")}
                />
              ),
            },
            background_check: {
              title: "Validación de expedientes",
              meta: application.checksAuthorizedAt
                ? `${checkProgress(application.checkResults).done} de ${checkProgress(application.checkResults).total} consultadas`
                : "Falta autorización",
              content: (
                <BackgroundCheckPanel
                  applicationId={application.id}
                  authorizedAt={application.checksAuthorizedAt}
                  isLandlord={isLandlord}
                  documentNumber={application.dossier.documentNumber}
                  results={application.checkResults}
                  readOnly={past("background_check")}
                />
              ),
            },
          }}
        />
      </div>
    </div>
  );
}
