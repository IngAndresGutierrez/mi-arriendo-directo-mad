/**
 * The product's own words, and the shape every other language has to match.
 *
 * **This file is the type.** `Dictionary` is `typeof es`, and `en.ts` is annotated with it, so a key
 * added here and not translated fails `pnpm typecheck` rather than rendering a Spanish sentence to
 * an English reader or, worse, `undefined`. It is the same device `categoryOf` uses to force a
 * decision about a new notification type — a complete `Record` rather than a `switch` with a
 * `default` — and it is the only mechanism in this repository that can keep two languages in step
 * without somebody remembering to.
 *
 * **No `as const`.** With it, `typeof es` would carry the literal Spanish strings and `en` could
 * only satisfy the type by repeating them. The widened `string` is the point.
 *
 * Parameterised copy is a **function**, never a template with placeholders to substitute later:
 * `${count} inmuebles` needs a plural rule, and Spanish and English do not put the number in the
 * same place as every language will. A function lets each locale write its own sentence, and the
 * signature is what typecheck compares.
 *
 * Keys are English, values are the language's — the `GENDER_LABELS` pattern the project already
 * uses (`{ female: "Femenino" }`), one level up.
 */
export const es = {
  common: {
    comingSoon: "Próximamente",
    countryCode: "Código de país",
    country: "País",
    opensInNewTab: "(se abre en una pestaña nueva)",
    loading: "Cargando…",
    save: "Guardar",
    /** The bare currency/measure words a screen needs around a number it did not compose. */
    perMonth: "al mes",
  },

  language: {
    /**
     * The accessible name of the switcher's trigger.
     *
     * The trigger shows the language **in force**, and the menu behind it lists every language named
     * in itself. So this label only has to say what the control *is*, and it says it in the language
     * on screen — the names inside the menu are what stay untranslated.
     */
    label: "Idioma",
  },

  /**
   * Firebase's error codes, translated into a sentence a person can act on.
   *
   * **The four credential errors deliberately share one message.** Telling "no such account" apart
   * from "wrong password" turns the login form into an account enumerator, and keeping that
   * discipline here while `/recuperar` also refuses to say is what makes either of them worth doing.
   */
  authErrors: {
    invalidCredential: "Correo o contraseña incorrectos",
    userDisabled: "Esta cuenta está deshabilitada. Escríbenos para reactivarla.",
    emailInUse: "Ya existe una cuenta con este correo. Inicia sesión.",
    weakPassword: "Esa contraseña es demasiado débil. Usa al menos 8 caracteres.",
    tooManyRequests: "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.",
    networkFailed: "Sin conexión. Revisa tu internet e inténtalo de nuevo.",
    popupClosed: "Cerraste la ventana de Google antes de terminar.",
    popupBlocked: "Tu navegador bloqueó la ventana de Google. Habilita las ventanas emergentes.",
    accountExistsOtherCredential:
      "Ya existe una cuenta con este correo. Inicia sesión con correo y contraseña.",
    operationNotAllowed: "Este método de acceso no está habilitado. Escríbenos para ayudarte.",
    unauthorizedDomain: "Este dominio no está autorizado para iniciar sesión.",
    fallback: "No pudimos completar la operación. Inténtalo de nuevo en un momento.",
  },

  nav: {
    comingSoon: "Próximamente",
    mainNav: "Navegación principal",
    home: "Inicio",
    myProperties: "Mis inmuebles",
    contracts: "Contratos",
    rentals: "Arriendos",
    tenantProfile: "Perfil de inquilino",
    tenantProfileShort: "Mi perfil",
    errands: "Encargos",
    support: "Soporte",
    settings: "Ajustes",
    /** The badge on an entry that is not built yet. */
    soon: "Pronto",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    expand: "Expandir menú",
    collapse: "Contraer menú",
    myPortal: "Mi portal",
    myProfile: "Mi perfil",
    signOut: "Cerrar sesión",
    signingOut: "Saliendo…",
  },

  auth: {
    email: "Correo electrónico",
    emailPlaceholder: "tu@correo.com",
    emailPlaceholderAlt: "tu@ejemplo.com",
    password: "Contraseña",
    passwordPlaceholder: "••••••••",
    signIn: "Iniciar sesión",
    signingIn: "Iniciando sesión…",
    creatingAccount: "Creando cuenta…",
    or: "o",
    continueWithGoogle: "Continuar con Google",
    requirementMet: "(cumplido)",
    requirementPending: "(pendiente)",
    quickStep: "Solo te llevará un minuto.",

    forgotPassword: "¿Olvidaste tu contraseña?",
    noAccount: "¿No tienes cuenta?",
    createFree: "Créala gratis",
    back: "Atrás",
    createAccountTitle: "Crear una cuenta",
    continueWithEmail: "Continuar con el correo",
    createAccount: "Crear cuenta",
    nextStepAsks: "En el siguiente paso te pediremos aceptar los",
    andAuthorize: "y autorizar el tratamiento de tus datos.",
    termsLink: "Términos y condiciones",
    /**
     * The two-tone headline on the auth panel: the second half is cyan, so it is two values and not
     * one string with markup in it.
     */
    panelLoginLead: "Conecta. Gestiona.",
    panelLoginAccent: "Acierta.",
    panelResetLead: "Volver a entrar,",
    panelResetAccent: "sin perder nada.",
    panelConfirmLead: "Casi listo.",
    panelConfirmAccent: "Elige tu contraseña.",

    welcomeBack: "Bienvenido de nuevo",
    enterCredentials: "Ingresa tus credenciales para entrar a tu portal.",
    completeProfileHeading: "Completa tu perfil",
    completeProfileNote: "Necesitamos estos datos para validar tu identidad y preparar tus contratos.",
    checkYourEmail: "Revisa tu correo",
    /**
     * Split around the address instead of interpolating it, because this sentence is rendered by a
     * **Client Component** and the email is client state. A parameterised entry is a function, and a
     * function cannot cross the RSC boundary — see the note on `CLIENT_SAFE` in `dictionary.ts`.
     */
    resetSentToBefore: "Si existe una cuenta con",
    resetSentToAfter:
      ", te enviamos un enlace para elegir una contraseña nueva. Vence en una hora y solo sirve una vez.",
    resetNotArrived:
      "¿No te llegó? Revisa la carpeta de spam. Si el correo no está registrado no recibirás nada — es la forma de no confirmarle a nadie más si tienes cuenta aquí.",
    backToSignIn: "Volver a iniciar sesión",
    resetFormNote: "Escribe el correo de tu cuenta y te enviamos un enlace para elegir una nueva.",
    sendLink: "Enviarme el enlace",
    sendingLink: "Enviando…",

    checkingLink: "Comprobando el enlace…",
    linkDead: "El enlace no sirve",
    /** Every reason a code is bad shares one sentence: "ya se usó" tells a leaked link it worked. */
    linkDeadNote: "Este enlace ya no sirve: pudo vencerse o haberse usado. Pide uno nuevo.",
    savePassword: "Guardar la contraseña",
    savingPassword: "Guardando…",
    changePassword: "Cambiar contraseña",
    changingPassword: "Cambiando…",
    passwordChanged: "Contraseña actualizada",
    passwordChangedNote:
      "Ya puedes entrar con tu contraseña nueva. Si habías iniciado sesión en otro dispositivo, tendrás que volver a entrar allí.",
    howYouSignIn: "Cómo entras",
    changeYourPassword: "Cambiar tu contraseña",
    changeYourPasswordNote:
      "Te pedimos la actual: sin eso, cualquiera que se encuentre tu sesión abierta podría quedarse con la cuenta.",
    yourPassword: "Tu contraseña",
    noPasswordHere:
      "No tienes una contraseña en este producto: entras con Google, y tanto la contraseña como la verificación en dos pasos las administra Google.",
    signOutEverywhereTitle2: "Cerrar sesión en todas partes",
    signOutEverywhereNote:
      "Si crees que alguien más entró a tu cuenta, esto invalida todas las sesiones abiertas. También la de este dispositivo.",
    signOutEverywhereButton: "Cerrar sesión en todos los dispositivos",
    securityUnavailable:
      "No pudimos leer el estado de tu cuenta en este momento. Recarga la página en un rato; tus preferencias de avisos siguen funcionando.",
    loginTitle: "Iniciar sesión",
    loginMeta:
      "Accede a tu portal de miarriendoDIRECTO.com para gestionar tus inmuebles, postulaciones y pagos.",
    loginPanel:
      "Conecta directamente entre propietario e inquilino, valida perfiles en minutos y gestiona cada etapa de tu contrato en una sola plataforma.",

    signupMeta:
      "Crea tu cuenta en miarriendoDIRECTO.com y arrienda sin intermediarios ni trámites innecesarios.",
    welcome: "Te damos la bienvenida",
    signupPanel:
      "Crea tu cuenta y únete a la nueva forma de arrendar, sin trámites innecesarios.",

    resetTitle: "Recuperar tu contraseña",
    resetMeta:
      "Te enviamos un enlace para elegir una contraseña nueva de tu cuenta de miarriendoDIRECTO.com.",
    resetHeading: "¿Olvidaste tu contraseña?",
    resetPanel:
      "Tus inmuebles, tus postulaciones y tus contratos siguen donde los dejaste. Solo necesitas una contraseña nueva.",
    /**
     * **Word for word the same on every branch**, and that is the whole security design of the
     * screen: unknown address, throttled, Google-only and a Resend failure all answer this. Anything
     * more definite turns the form into an account-enumeration oracle, and `password-reset.mjs`
     * asserts the two confirmations are identical rather than merely similar.
     */

    newPasswordTitle: "Elige una contraseña nueva",
    newPasswordMeta: "Termina de recuperar tu cuenta de miarriendoDIRECTO.com.",
    newPasswordNote: "Después de guardarla podrás entrar con ella en cualquier dispositivo.",
    newPassword: "Contraseña nueva",
    nothingToChange: "Aquí no hay nada que cambiar",
    missingCode:
      "Esta pantalla necesita el código que viene en el correo de recuperación. Si acabas de elegir tu contraseña nueva, ya está guardada: entra con ella.",
    askNewLink: "Pedir un enlace nuevo",

    completeProfileTitle: "Completa tu perfil",
    completeProfileMeta: "Completa tus datos para empezar a usar miarriendoDIRECTO.com.",

    currentPassword: "Contraseña actual",
    /**
     * **Not `authErrors.invalidCredential`.** There the message is shared so the login cannot
     * enumerate accounts; here there is no account to guess — it is yours and you are already inside
     * — and "correo o contraseña incorrectos" on a form with no email field says nothing.
     */
    wrongCurrentPassword: "Esa no es tu contraseña actual.",

    providerEmailLabel: "Correo y contraseña",
    providerEmailNote: "Entras con tu correo y una contraseña que eliges tú.",
    providerGoogleLabel: "Google",
    providerGoogleNote:
      "Tu contraseña y la verificación en dos pasos las administra Google, así que aquí no hay nada que configurar.",
    providerPhoneLabel: "Código a tu teléfono",
    providerPhoneNote: "Entras con un código de un solo uso, sin contraseña.",
    providerOtherLabel: "Otro método",
    providerOtherNote: "Escríbenos si quieres cambiar cómo entras.",
    emailVerified: "Correo verificado",
    yes: "Sí",
    notYet: "Todavía no",
    lastSignIn: "Última entrada",
    accountCreated: "Cuenta creada",

    signOutEverywhereTitle: "¿Cerrar sesión en todos los dispositivos?",
    signOutEverywhereBody:
      "Se cerrará la sesión en cualquier navegador o teléfono donde hayas entrado, incluido este. Tendrás que volver a iniciar sesión.",
    signOutEverywhereConfirm: "Cerrar todas",
    signOutEverywherePending: "Cerrando…",
  },

  support: {
    writeOnWhatsApp: "Escribir por WhatsApp",
    sendEmail: "Enviar un correo",
    copyEmail: "Copiar correo",
    emailCopied: "Correo copiado",
    copiedToClipboardAfter: "copiado al portapapeles",
    copyFailed: "No pudimos copiarlo. La dirección es",
    opensInNewTab: "(se abre en una pestaña nueva)",
    team: "Equipo de soporte",
    /** Split around the name for the reason `resetSentToBefore` is: `support` is client-safe. */
    greetingBefore: "Hola",
    greetingAfter: ", escríbenos si tienes dudas sobre tu arriendo, tu contrato o tus pagos.",
    whatsappLabel: "WhatsApp:",
    emailLabel: "Correo:",
    seeSupportPage: "Ver la página de soporte",
  },

  /**
   * The publish/edit form and the landlord's own listing card.
   *
   * Separate from `property`, which is the *public* vocabulary a listing is described with: this is
   * the portal side — the form a landlord fills in and the card they manage it from. They share the
   * label records (`propertyLabels`) and nothing else.
   */
  propertyForm: {
    sectionProperty: "El inmueble",
    sectionFeatures: "Características",
    sectionLocation: "Ubicación",
    sectionTerms: "Condiciones",
    sectionPhotos: "Fotos",

    title: "Título del anuncio",
    titlePlaceholder: "Apartamento luminoso en Palermo",
    description: "Descripción",
    descriptionPlaceholder:
      "Cuéntale al inquilino cómo es el inmueble, qué incluye y qué hay cerca.",
    type: "Tipo de inmueble",
    typePlaceholder: "Selecciona el tipo",

    area: "Área (m²)",
    stratum: "Estrato",
    select: "Selecciona",
    bedrooms: "Habitaciones",
    bathrooms: "Baños",
    parking: "Parqueadero",
    furnished: "Amoblado",
    petsAllowed: "Acepta mascotas",

    department: "Departamento",
    departmentPlaceholder: "Selecciona el departamento",
    city: "Ciudad",
    neighborhood: "Barrio",
    address: "Dirección",
    addressPlaceholder: "Calle 60 #10-20 apto 301",
    addressTooltip:
      "Solo la ve el inquilino cuya postulación apruebes. En el anuncio se muestran el barrio y la ciudad.",
    registryNumber: "Número de matrícula inmobiliaria",
    registryPlaceholder: "050-123456",
    registryTooltip:
      "El número del certificado de tradición, que expide la Oficina de Registro de Instrumentos Públicos. No se publica: identifica el inmueble ante el registro.",

    rent: "Canon mensual (COP)",
    rentPlaceholder: "1.800.000",
    adminFee: "Administración (COP)",
    adminFeeHint: "Escribe 0 si el inmueble no paga administración.",
    availableFrom: "Disponible desde",
    minLease: "Duración mínima",
    minLeasePlaceholder: "Selecciona la duración",

    copyLink: "Copiar enlace",
    linkCopied: "Enlace copiado",
    copyLinkFailed: "Tu navegador no nos dejó copiar el enlace. Ábrelo y cópialo desde la barra.",
    deleteFailed: "No pudimos eliminar el inmueble.",
    deleteTitle: "¿Eliminar este inmueble?",
    deleteBefore: "Se elimina",
    deleteAfter: "con sus fotos y su enlace deja de funcionar. No se puede deshacer.",
    deleteConfirm: "Eliminar inmueble",

    addPhotos: "Agregar fotos",
    addMorePhotos: "Agregar más fotos",
    uploadingPhotos: "Subiendo…",
    uploadingPhotosStatus: "Subiendo las fotos.",
    photoSessionExpired: "Tu sesión expiró. Vuelve a iniciar sesión para subir fotos.",
    photoUploadFailed: "No pudimos subir las fotos. Revisa tu conexión e inténtalo de nuevo.",
    removePhotoTitle: "¿Quitar esta foto?",
    removePhotoBody:
      "Deja de verse en el anuncio y se borra al guardar los cambios. No se puede deshacer.",
    removePhotoConfirm: "Quitar foto",
    removePhotoPending: "Quitando…",

    /*
      El video del inmueble. Uno solo: un inmueble tiene un recorrido, y tres clips obligarían al
      inquilino a elegir cuál ver. La pista dice MP4 primero porque es el único de los tres que se
      reproduce en todos los navegadores — un .mov de iPhone no lo hace en Chrome, y eso no es algo
      que este producto pueda arreglar sin transcodificar.
    */
    videoLabel: "Video del inmueble",
    videoOptional: "Opcional",
    addVideo: "Agregar video",
    changeVideo: "Cambiar video",
    removeVideo: "Quitar video",
    uploadingVideo: "Subiendo…",
    uploadingVideoStatus: "Subiendo el video.",
    videoPreviewLabel: "Vista previa del video que subiste",
    videoHint:
      "Un recorrido corto muestra lo que las fotos no pueden: cómo se conectan los espacios y cuánta luz entra. MP4, MOV o WEBM, hasta 50 MB. En MP4 se ve en todos los dispositivos.",
    videoTooLarge: "El video pesa más de 50 MB. Recórtalo o graba uno más corto.",
    videoUnsupported: "Solo MP4, MOV o WEBM.",
    videoEmpty: "Ese archivo está vacío.",
    videoUploadFailed: "No pudimos subir el video. Revisa tu conexión e inténtalo de nuevo.",
    videoRejected:
      "El servidor no aceptó el archivo. Revisa que sea MP4, MOV o WEBM y que no pase de 50 MB.",
    videoSessionExpired: "Tu sesión expiró. Vuelve a entrar para subir el video.",
    removeVideoTitle: "¿Quitar el video?",
    removeVideoBody:
      "Deja de mostrarse en el anuncio y se borra cuando guardes. No se puede deshacer.",
    removeVideoConfirm: "Quitar video",
    removeVideoPending: "Quitando…",

    mapLabel: "Ubicación en el mapa",
    mapHintField: "la ubicación en el mapa",
    mapHintBefore: "En el anuncio se publica una zona de unos",
    mapHintAfter:
      "metros a la redonda, nunca este punto: la ubicación exacta solo la ves tú, igual que la dirección.",
    optional: "(opcional)",
    mapInstructions: "Mueve el mapa hasta que la cruz quede sobre el inmueble. Con el teclado: flechas para mover,",
    mapInstructionsZoom: "para acercar.",
    zoomIn: "Acerca más el mapa para marcar el inmueble.",
    centerOnNeighborhood: "Centrar en el barrio",
    searchingNeighborhood: "Buscando el barrio…",
    pointMarked: "Punto marcado:",
    noPoint: "Sin punto en el mapa. Puedes publicar sin marcarlo.",


    /*
      Los dos botones del formulario. "Publicar inmueble" sigue siendo el `accent` de la vista y
      el borrador es `brand`: son dos salidas de la misma pantalla, no dos llamadas a la acción.
    */
    saveDraft: "Guardar como borrador",
    savingDraft: "Guardando borrador…",
    draftHint:
      "¿Todavía no tienes las fotos? Guarda el borrador con el resto de la información: solo lo ves tú, y desde tu lista puedes encargarle las fotos a alguien.",
    publishDraft: "Publicar",
    publishingDraft: "Publicando…",
    publishDraftNoPhotos: "Súbele al menos una foto para poder publicarlo.",
    publishDraftFailed: "No pudimos publicar el inmueble.",

    publish: "Publicar inmueble",
    publishing: "Publicando…",
    saveChanges: "Guardar cambios",
    saving: "Guardando…",
  },

  /** The portal's own pages: the headings and empty states behind a session. */
  portal: {
    greetingMorning: "Buenos días",
    greetingAfternoon: "Buenas tardes",
    greetingEvening: "Buenas noches",
    welcomeBackBefore: "Bienvenido de nuevo",
    shortcutsAria: "Atajos y ayuda",
    lookingForHome: "¿Buscas un nuevo hogar?",
    browseProperties: "Explora los inmuebles disponibles",
    tip: "Consejo",
    tipBody:
      "Ten tu cédula y tu certificado laboral a mano: con los documentos al día, una postulación se aprueba en minutos.",
    homeTitle: "Inicio",
    homeMeta: "Tu portal en miarriendoDIRECTO.com.",

    myPropertiesTitle: "Mis inmuebles",
    myPropertiesMeta: "Gestiona los inmuebles que publicaste en miarriendoDIRECTO.com.",
    nonePublishedYet: "Todavía no has publicado ninguno.",
    publishedCount: (n: number) => `${n} ${n === 1 ? "publicado" : "publicados"}.`,
    myPropertiesEmpty:
      "Publica tu primer inmueble y compártelo: el inquilino se postula directamente contigo, sin intermediarios.",

    contractsTitle: "Contratos",
    contractsMeta: "Los procesos en curso y los que ya se cerraron, etapa por etapa.",
    contractsOpen: (n: number) => `Contratos en curso (${n})`,
    contractsClosed: (n: number) => `Procesos cerrados (${n})`,
    contractsIntro: "Cada arriendo, de la postulación a la firma. Aquí lo ven las dos partes.",
    contractsEmpty:
      "Todavía no hay ningún arriendo en curso. Empieza postulándote a un inmueble, o espera a que alguien se postule a los tuyos.",
    seeProperties: "Ver inmuebles",
    fillTenantProfile: "Llenar mi perfil de inquilino",

    rentalsTitle: "Arriendos",
    rentalsMeta: "Los arriendos en curso, mes a mes: lo que se pagó y lo que falta.",
    rentalsIntro: "Los arriendos que ya están andando, mes a mes. Aquí lo ven las dos partes.",
    rentalsLoadFailed: "No pudimos cargar tus arriendos",
    rentalsLoadFailedBody:
      "Fue un problema nuestro, no tuyo, y no le pasó nada a tu información. Vuelve a cargar la página en un momento; si sigue igual, escríbenos.",
    retry: "Volver a intentar",
    writeToSupport: "Escribir a soporte",
    rentalsEmpty:
      "Todavía no tienes ningún arriendo en curso. Un arriendo empieza aquí cuando el proceso llega a su última etapa y el propietario confirma el primer canon.",
    seeMyContracts: "Ver mis contratos",

    yourDetails: "Tus datos",
    yourDetailsNote: "Es lo que ve la otra parte de un proceso. Los mismos datos aparecen en",
    personalDetails: "Tus datos personales",
    tenantProfileIntro:
      "Lo que un propietario necesita saber de ti. Se guarda una vez y viaja contigo a cada postulación; ahí podrás revisarlo antes de enviarlo.",
    errandsTitle: "Encargos",
    errandsIntro: "Lo que le pediste a alguien más sobre tus inmuebles, y en qué va cada uno.",
    newErrand: "Nuevo encargo",
    createErrand: "Crear un encargo",
    errandsEmpty:
      "Todavía no has encargado nada. Puedes crear uno aquí, o desde el botón «Encargar» de cualquiera de tus inmuebles.",
    errandLate: " · se pasó la fecha",
    errandDeclined: "No pudo:",
    errandCompleted: "Contó:",
    errandCancelled: "Lo cancelaste:",
    settingsTitle: "Ajustes",
    settingsMeta: "Tus datos, tus avisos y cómo entras a tu cuenta.",
    settingsIntro: "Tus datos, de qué te avisamos y cómo entras a tu cuenta.",
    emailNotEditable: "El correo viene de tu forma de entrar y no se edita aquí.",
    sameAsBefore: "tu perfil de inquilino",
    sameAsAfter: ": cambiarlos en cualquiera de los dos sitios los cambia en el otro.",

    tenantProfileTitle: "Perfil de inquilino",
    tenantProfileMeta: "Los datos que envías con cada postulación, guardados una sola vez.",
    tenantProfilePrivate: "Nadie más que tú puede ver esta página",
    tenantProfilePrivateAfter:
      ": un propietario solo recibe una copia cuando tú te postulas a su inmueble.",
  },

  /** The tenant dossier: the reusable profile a tenant fills in once and sends with each application. */
  dossier: {
    documentTypes: {
      cc: "Cédula de ciudadanía",
      ce: "Cédula de extranjería",
      passport: "Pasaporte",
    },
    occupations: {
      employee: "Empleado",
      self_employed: "Independiente",
      business_owner: "Tengo mi propio negocio",
      student: "Estudiante",
      retired: "Pensionado",
    },
    /** What the employer field is asking for, which depends on how the person earns. */
    employerLabels: {
      employee: "Dónde trabajas",
      self_employed: "A qué te dedicas",
      business_owner: "Tu negocio",
      student: "Dónde estudias",
      retired: "De dónde recibes tu pensión",
    },
    documentLabels: {
      id_front: "Cédula por el frente",
      id_back: "Cédula por detrás",
      id_both: "Cédula (ambos lados)",
      employment_letter: "Certificado laboral",
      payslip: "Desprendibles de nómina",
      rut: "RUT",
      tax_return: "Declaración de renta",
      bank_statement: "Extractos bancarios",
      chamber_of_commerce: "Cámara de Comercio",
      pension_certificate: "Certificado de pensión",
      pension_payslip: "Desprendibles de la mesada",
      study_certificate: "Certificado de estudios",
    },
    documentHints: {
      id_front: "La foto o el escaneo del frente, legible y completo.",
      id_back: "El reverso del mismo documento.",
      id_both: "Un solo archivo con las dos caras, como lo entrega un escáner.",
      employment_letter: "Con tu cargo, tu salario, tu antigüedad y el tipo de contrato.",
      payslip: "Los tres últimos, uno por archivo.",
      rut: "El que expide la DIAN, actualizado.",
      tax_return: "Solo si declaras renta. Si no, déjalo vacío.",
      bank_statement: "Los tres últimos meses, uno por archivo.",
      chamber_of_commerce: "El certificado de existencia, renovado este año.",
      pension_certificate: "La resolución o el certificado de tu pensión.",
      pension_payslip: "Los tres últimos, uno por archivo.",
      study_certificate: "El que expide tu universidad o instituto, del semestre en curso.",
    },

    previewOf: "Previsualización de",
    uploading: "Subiendo",
    file: "archivo",
    of: "de",
    chooseOneMasc: "Elige uno",
    occupation: "Ocupación",
    monthlyIncome: "Ingresos mensuales (COP)",
    referenceRelationHint: "Jefe, arrendador anterior, colega…",
    uploadAgain: " Súbelo otra vez.",
    removeDocumentBefore: "Se elimina",
    removeDocumentAfter: "y tendrás que subirlo otra vez. No se puede deshacer.",
    removeDocumentConfirm: "Quitar documento",
    removeDocumentPending: "Quitando…",
    whoYouAre: "Quién eres",
    documentType: "Tipo de documento",
    documentNumber: "Número de documento",
    chooseOne: "Elige una",
    howYouEarn: "De qué vives",
    monthlyIncomeHint: "Lo que recibes al mes, antes de descuentos.",
    household: "Personas que vivirían ahí",
    pets: "Mascotas",
    hasPets: "Tengo mascotas",
    tellTheLandlord: "Cuéntale al propietario",
    petsHint:
      "Cuántas, de qué tipo y tamaño. Es la razón más común por la que se rechaza una postulación: decirlo de frente juega a tu favor.",
    reference: "Referencia personal",
    referenceIntro:
      "Alguien que pueda hablar por ti. No es un codeudor: la garantía se define más adelante.",
    referenceName: "Nombre de tu referencia",
    referenceRelation: "Qué relación tienen",
    referencePhone: "Teléfono de tu referencia",
    referenceAuthorized:
      "Esta persona sabe que voy a dar su nombre y su teléfono, y me autorizó a hacerlo.",

    yourDetails: "Tus datos",
    yourDetailsNote: "Los que diste al crear tu cuenta. Corrígelos aquí si algo cambió.",
    saveMyDetails: "Guardar mis datos",
    savedConfirmation: "Listo, tus datos quedaron guardados.",

    uploadSessionExpired: "Tu sesión expiró. Vuelve a iniciar sesión para subir tus documentos.",
    uploadFailed: "No pudimos subir el archivo. Revisa tu conexión e inténtalo de nuevo.",
    landlordRejected: "El propietario no lo aceptó.",
    removeDocumentTitle: "¿Quitar este documento?",
    idInOneFile: "Tengo mi cédula en un solo archivo, con las dos caras",
    ifApplicable: "Si aplica",
    rejected: "Rechazado.",
    remove: "Quitar",
  },

  /**
   * Copy that only ever leaves through `notify()` — an email or a bell, never a Client Component.
   *
   * It is in `SERVER_ONLY_NAMESPACES`, so it may hold functions: nothing here crosses the RSC
   * boundary, and a sentence that interpolates a document's name is clearer as one function than as
   * two halves a caller has to reassemble.
   */
  notify: {
    documentIs: (label: string) => `Se trata de: ${label}.`,
  },

  /**
   * The rental process: eight stages, and **two second persons**.
   *
   * Both sides read the same screen, so one set of sentences cannot serve them — "el propietario te
   * llamará" is nonsense to the landlord, who is the one who has to call. `stageDescriptions` is the
   * tenant's and `stageDescriptionsLandlord` is the landlord's, and they stay two lists rather than
   * one with a role switch inside because the sentence that tells the tenant to wait is the sentence
   * that tells the landlord to act.
   *
   * `SERVER_ONLY_NAMESPACES` does **not** list this one, so everything in it must be a plain string:
   * the stage panels are Client Components and receive it whole.
   */
  application: {
    stageLabels: {
      submitted: "Postulación recibida",
      visit: "Visita al inmueble",
      tenant_data: "Datos y documentos del inquilino",
      background_check: "Validación de expedientes",
      interview: "Entrevista con el propietario",
      guarantee: "Póliza de arrendamiento",
      contract_signature: "Firma del contrato",
      first_payment: "Primer canon",
    },
    stageDescriptions: {
      submitted: "El propietario ya tiene tu postulación y los datos que declaraste.",
      visit:
        "Ve a conocer el inmueble. El propietario propone el día y el punto de encuentro, y después nos dices si te interesa.",
      tenant_data: "Sube tu documento de identidad y el soporte de tus ingresos.",
      background_check:
        "Con tu autorización se revisan tus antecedentes judiciales, multas de tránsito y sanciones disciplinarias.",
      interview:
        "El propietario propondrá una fecha para hablar 30 minutos contigo. Confírmala aquí y quedan cuadrados.",
      guarantee:
        "El propietario toma una póliza de arrendamiento con Sura. No necesitas codeudor.",
      contract_signature: "Firmen el contrato de arrendamiento por 6 o 12 meses.",
      first_payment:
        "Paga el primer canon y sube el comprobante. En cuanto el propietario confirme que llegó, el proceso termina y empieza el arriendo.",
    },
    stageDescriptionsLandlord: {
      submitted: "Revisa lo que declaró el inquilino y decide si sigues con él.",
      visit:
        "Propón un día y un punto de encuentro para que el inquilino conozca el inmueble. Él dirá si le interesa.",
      tenant_data: "Pídele su documento de identidad y el soporte de sus ingresos.",
      background_check:
        "Consulta sus antecedentes judiciales, de tránsito y disciplinarios, y marca el resultado.",
      interview:
        "Propón una fecha para hablar 30 minutos con el inquilino y, después, escribe aquí cómo te fue.",
      guarantee:
        "Toma la póliza de arrendamiento con Sura — sin codeudor — y registra aquí su número.",
      contract_signature: "Firmen el contrato de arrendamiento por 6 o 12 meses.",
      first_payment:
        "Confirma que recibiste el primer canon: con eso termina el proceso y arranca el arriendo.",
    },
    statusLabels: {
      open: "En proceso",
      rejected: "Rechazada",
      withdrawn: "Retirada",
    },

    /**
     * Plain pieces, not a function: `application` is handed whole to the stage panels, which are
     * Client Components — see `SERVER_ONLY_NAMESPACES`. The commas and the colon are punctuation and
     * stay in the component.
     */
    stageWord: "Etapa",
    stageDone: "completada",
    stageCurrent: "en curso",
    stagePending: "pendiente",
    advanceTo: "Continuar a",
    completedLabel: "Arriendo en curso",
    completedDescription:
      "El proceso terminó y el arriendo está en curso. Tus pagos y tu contrato viven ahora en Arriendos.",
    completedDescriptionLandlord:
      "El proceso terminó y el arriendo está en curso. Los pagos y el contrato viven ahora en Arriendos.",
    processCompleted: "Proceso completado",
    stepOf: "Paso",
    stepOfSeparator: "de",
    closedAtStage: "en la etapa",
  },

  /**
   * The visit stage: the second one, and the one whose verdict is the tenant's alone.
   *
   * `blockers` is keyed by the reason and then by who is reading, because the sentence that tells the
   * tenant to answer is the sentence that tells the landlord to wait — the same two-voice rule the
   * stage descriptions follow.
   */
  visit: {
    outcomes: {
      interested: "Me interesa el inmueble",
      not_interested: "No me interesa el inmueble",
    },
    states: {
      none: "Sin agendar",
      proposed: "Esperando confirmación",
      declined: "Hay que proponer otro día",
      confirmed: "Agendada",
      interested: "Visita hecha · sí le interesa",
      not_interested: "Visita hecha · no le interesa",
    },
    blockers: {
      notProposedLandlord: "Propón un día y un punto de encuentro para la visita antes de continuar.",
      notProposedTenant: "El propietario todavía no ha propuesto un día para conocer el inmueble.",
      notConfirmedLandlord: "El inquilino aún no confirma el día de la visita.",
      notConfirmedTenant: "Confirma el día de la visita para que el proceso pueda seguir.",
      noVerdictLandlord: "Después de la visita, el inquilino tiene que decir si el inmueble le interesa.",
      noVerdictTenant: "Después de la visita, dinos si el inmueble te interesa para poder continuar.",
      notInterestedLandlord:
        "Al inquilino no le interesó el inmueble, así que el proceso no sigue. Puedes rechazar la postulación o proponer otra visita.",
      notInterestedTenant:
        "Dijiste que el inmueble no te interesa, así que el proceso no sigue. Si cambiaste de opinión, actualízalo aquí; si no, puedes retirar tu postulación.",
    },

    saveFailed: "No pudimos guardar el cambio.",
    proposeIntroLandlord:
      "Propón un día y un punto de encuentro para que el inquilino vaya a conocer el inmueble.",
    proposeIntroTenant:
      "El propietario propondrá un día para que vayas a conocer el inmueble. Te avisaremos aquí y por correo.",
    proposeTitle: "Propón la visita al inmueble",
    proposeAnotherTitle: "Propón otro día para la visita",
    proposeAnother: "Proponer otro día",
    noDay: "Sin día",
    tenantDeclined: "Al inquilino no le sirve ese día.",
    youAskedAnother: "Pediste otro día.",
    tenantInterested: "Al inquilino le interesa el inmueble",
    tenantNotInterested: "Al inquilino no le interesa el inmueble",
    confirmVisit: "Confirmar la visita",
    cantThatDay: "No puedo ese día",
    whichDayWorks: "¿Qué día te sirve?",
    sendAndAskAnother: "Enviar y pedir otro día",
    cancel: "Cancelar",
    weToldTheLandlord: "Le avisamos al propietario que ese día no te sirve. Te escribirá con otro.",
    awaitingTenant: "El inquilino todavía no confirma el día. Te avisamos en cuanto responda.",
    changeMyAnswer: "Cambiar lo que respondí",
    changeYourAnswer: "Cambia lo que respondiste",
    afterTheVisit: "Después de la visita",
    interested: "Me interesa",
    saving: "Guardando…",
    confirming: "Confirmando…",
    sending: "Enviando…",
    proposeAndNotify: "Proponer y avisar al inquilino",
    notInterested: "No me interesa",

    date: "Fecha",
    time: "Hora (Colombia)",
    meetingPoint: "Punto de encuentro",
    meetingPointHint:
      "Solo lo ve el inquilino de esta postulación, en esta página: nunca sale en un correo.",
    meetingPointPlaceholder: "Cra 23 #14-08, portería de la torre 2",
    message: "Mensaje (opcional)",
    messagePlaceholder: "Timbra en el 502. Hay parqueadero de visitantes.",
    whatYouThought: "Qué te pareció (opcional)",
    whatYouThoughtHint:
      "El propietario también lo lee. Sin tu respuesta el proceso no puede avanzar.",
    whatYouThoughtPlaceholder: "Me gustó la luz, pero la cocina es pequeña.",
    whichDayPlaceholder: "Los sábados por la mañana.",
      unconfirmed: "Sin confirmar",
    visited: "Visitada",
    confirmedBadge: "Confirmada",
    landlordWaitsVerdict:
      "Cuando el inquilino vaya, él dirá aquí si el inmueble le interesa. Sin eso el proceso no puede avanzar.",
},

  /** The interview stage: mostly about agreeing on a time, and the landlord writes the conclusion. */
  interview: {
    channels: {
      meet: "Videollamada por Google Meet",
      whatsapp: "Videollamada por WhatsApp",
      phone: "Llamada telefónica",
    },
    results: {
      went_well: "Salió bien",
      with_reservations: "Con reparos",
    },
    states: {
      none: "Sin agendar",
      proposed: "Esperando confirmación",
      declined: "Hay que proponer otro horario",
      confirmed: "Agendada",
      done: "Realizada",
    },
    blockers: {
      notProposedLandlord: "Propón una fecha y una hora para la entrevista antes de continuar.",
      notProposedTenant: "El propietario todavía no ha propuesto una fecha para la entrevista.",
      notConfirmedLandlord: "El inquilino aún no confirma el horario propuesto.",
      notConfirmedTenant: "Confirma el horario propuesto para que el proceso pueda seguir.",
      noFeedbackLandlord: "Después de la entrevista, escribe cómo te fue para poder continuar.",
      noFeedbackTenant: "El propietario todavía no ha registrado cómo fue la entrevista.",
    },

    confirmedBadge: "Confirmada",
    noSlotBadge: "Sin horario",
    unconfirmedBadge: "Sin confirmar",
    minutes: "minutos",
    saveFailed: "No pudimos guardar el cambio.",
    whatsappNote: "La videollamada será por WhatsApp, al número que registraron.",
    phoneNote: "Será una llamada telefónica al número que registraron.",
    confirmSlot: "Confirmar el horario",
    proposeAnother: "Propón otro horario",
    proposeAnotherAction: "Proponer otro horario",
    channelLabel: "Por dónde",
    channelPlaceholder: "Elige el medio",
    declineHint: "Si no te sirve, dime qué días puedes.",
    declinePlaceholder: "Entre semana después de las 6 p. m.",
    howDidItGo: "¿Cómo te fue?",
    chooseOption: "Elige una opción",
    conclusionPlaceholder: "Quedó de enviar el soporte de ingresos del mes pasado.",
    saveConclusion: "Guardar la conclusión",
    weToldTheLandlord: "Le avisamos al propietario que ese horario no te sirve. Te escribirá con otro.",
    confirmedNote:
      "Confirmaste la entrevista. Después de hablar, el propietario escribirá aquí cómo fue.",
    joinCall: "Entrar a la videollamada",
    whichSlotWorks: "¿Qué horario te sirve?",
    sendAndAskAnother: "Enviar y pedir otro horario",
    cancel: "Cancelar",
    cantThatTime: "No puedo a esa hora",
    date: "Fecha",
    time: "Hora (Colombia)",
    meetingLink: "Enlace de la reunión",
    createMeet: "Crear la reunión en Google Meet",
    message: "Mensaje (opcional)",
    afterTheInterview: "Después de la entrevista",
    conclusionLabel: "Qué quedó de la conversación",
    conclusionHint: "El inquilino también lo lee. Sin esto el proceso no puede avanzar.",
    confirming: "Confirmando…",
    sending: "Enviando…",
    saving: "Guardando…",
  },

  /**
   * The guarantee stage: Sura's rental insurance policy, and the switch that declines it.
   *
   * `waivedNote` is the sentence that must be read *before* the switch, not after: Ley 820 forbids a
   * cash deposit, so with the policy declined there is nothing behind the lease at all.
   */
  guarantee: {
    product: "Seguro de arrendamiento digital",
    coverages: {
      rent: "Pago del arriendo si el inquilino incumple.",
      adminFee: "Pago de las cuotas de administración.",
      assistance:
        "Asistencia domiciliaria: plomería, electricidad, cerrajería, reemplazo de vidrios, gastos de traslado y asistencia jurídica telefónica.",
    },
    states: {
      none: "Sin solicitar",
      requested: "En estudio",
      active: "Póliza activa",
      waived: "Sin póliza, por decisión del propietario",
    },
    limitNoteBefore: "Si hay reclamación, la cobertura se mantiene hasta que se restituya el inmueble o hasta que el inquilino pague lo que debe, con un máximo de",
    limitNoteAfter: "meses. El seguro tiene que estar vigente y al día.",
    waivedNote:
      "Sin póliza no hay nada que responda por el arriendo si el inquilino incumple: la ley prohíbe pedir depósito en efectivo, así que el seguro es la única garantía que este proceso ofrece. Puedes volver a activarlo mientras el proceso siga en esta etapa.",
    waivedTenantNote:
      "El propietario decidió no pedir póliza de arrendamiento para este proceso. No tienes que hacer nada: nadie va a estudiar tu perfil para el seguro y Sura no te va a escribir.",
    blockers: {
      notRequestedLandlordBefore: "Solicita la póliza de arrendamiento en",
      notRequestedLandlordAfter: "para continuar, o marca que este arriendo va sin póliza.",
      notRequestedTenant: "El propietario todavía no ha solicitado la póliza de arrendamiento.",
      notIssuedLandlord: "Cuando Sura expida la póliza, registra su número aquí para continuar.",
      notIssuedTenant: "La póliza está en estudio. El propietario la registrará aquí cuando Sura la expida.",
    },

    saveFailed: "No pudimos guardar el cambio.",
    goesWithPolicy: "Este arriendo lleva póliza de arrendamiento",
    withoutPolicy: "Sin póliza de arrendamiento",
    withoutPolicyByYou:
      "Este arriendo va sin póliza de arrendamiento, por tu decisión en esta etapa.",
    noCosigner: "Sin codeudor",
    policy: "Póliza",
    yourPart: "Tu parte del seguro",
    seeQuoterData: "Ver los datos del cotizador",
    whatTheQuoterAsks: "Lo que te va a pedir el cotizador",
    ofTheProperty: "Del inmueble",
    ofTheTenant: "Del inquilino",
    address: "Dirección",
    adminFeeValue: "Valor de la administración",
    contractLength: "Duración del contrato",
    registryNumber: "Matrícula inmobiliaria",
    documentType: "Tipo de documento",
    documentNumber: "Número de documento",
    email: "Correo electrónico",
    alreadyRequested: "Ya la solicité, están estudiando el caso.",
    suraLinkForTenant: "Enlace de Sura para el inquilino",
    noteForTenant: "Nota para el inquilino (opcional)",
    policyNumber: "Número de la póliza",
    registerPolicy: "Registrar la póliza",
    policyActiveNext: "La póliza quedó activa. El siguiente paso es la firma del contrato.",
    copied: "Copiado",
    copyAction: "Copiar",
    copyByHand: "Cópialo a mano",
    saving: "Guardando…",
      lawDoesNotRequire:
      "La ley no exige seguro. Si vas a arrendar sin él, apágalo y el proceso sigue sin pedirte póliza.",
    quoterHint:
      "Cópialo de aquí. Los montos se copian sin puntos ni signo, como los pide el formulario.",
    monthlyRentValue: "Valor mensual del arrendamiento",
    savedTenantSees: "Guardado. El inquilino ya lo ve.",
    planNote: "Es el que cubre la administración y la asistencia domiciliaria.",
    linkPromptBefore: "Al terminar la cotización,",
    linkPromptAfter: "te da un enlace para el inquilino. Pégalo aquí: se guarda solo y le avisamos.",
    alwaysChoosePlanBefore: "Elige siempre el plan",
},

  metadata: {
    siteName: "miarriendoDIRECTO.com",
    /** The `%s · brand` template's default, used by any page that sets no title of its own. */
    defaultTitle: "miarriendoDIRECTO.com",
    defaultDescription:
      "Arrienda sin intermediarios: conecta propietarios e inquilinos, valida perfiles y gestiona contratos y pagos en una sola plataforma.",
    landingTitle: "miarriendoDIRECTO.com · Arrienda directo, sin intermediarios",
    landingDescription:
      "Arrienda directamente con el propietario en Colombia: sin comisión de inmobiliaria y sin fiador. Perfiles verificados, contrato firmado en línea y cada pago con su soporte.",
    landingOgDescription:
      "Arrienda directamente con el propietario en Colombia: sin comisión de inmobiliaria y sin fiador.",
  },

  header: {
    homeAriaLabel: "miarriendoDIRECTO.com, inicio",
    sectionsAriaLabel: "Secciones",
    properties: "Inmuebles",
    howItWorks: "Cómo funciona",
    contact: "Contacto",
    publishProperty: "Publicar inmueble",
    signIn: "Iniciar sesión",
  },

  footer: {
    legalAriaLabel: "Información legal",
    terms: "Términos y condiciones",
    privacy: "Tratamiento de datos",
    cookies: "Cookies",
    contact: "Contacto",
  },

  landing: {
    hero: {
      eyebrow: "Arriendo directo en Colombia",
      /** Two nodes so the second can be cyan; one string could not carry the emphasis. */
      titleLead: "Arrienda directo.",
      titleAccent: "Sin intermediarios.",
      body: "Habla directamente con el propietario, sin comisión de inmobiliaria y sin fiador. Perfiles verificados, contrato firmado en línea y cada pago con su soporte, todo en un mismo lugar.",
      landlordPrompt: "¿Tienes un inmueble para arrendar?",
      landlordLink: "Publícalo gratis",
      cityLabel: "Ciudad",
      anyCity: "Todas las ciudades",
      typeLabel: "Tipo de inmueble",
      anyType: "Cualquier tipo",
      search: "Buscar",
    },

    why: {
      title: "Un arriendo con menos gente en el medio",
      body: "Propietario e inquilino se hablan directo. Lo que aporta la plataforma es lo que se pierde en una conversación de WhatsApp: el respaldo, el contrato y el registro de lo acordado.",
      noFeesTitle: "Sin intermediarios ni comisión",
      noFeesBody:
        "Publicar es gratis y no cobramos comisión de inmobiliaria. El canon lo transfiere el inquilino directo a la cuenta del propietario: esta plataforma no mueve el dinero, lo deja documentado.",
      verifiedTitle: "Perfiles verificados, sin fiador",
      verifiedBody:
        "El inquilino arma una vez su perfil —documentos, ingresos y referencias— y el propietario lo revisa aquí. La póliza de arrendamiento reemplaza al codeudor, que es el requisito que frena la mayoría de las postulaciones en Colombia.",
      contractTitle: "Contrato firmado en línea",
      contractBody:
        "Cada parte firma con un código de un solo uso enviado al canal que ya verificó, y la firma queda atada al archivo exacto: si el contrato cambia, las firmas dejan de valer solas.",
    },

    how: {
      title: "Cómo funciona",
      body: "El mismo proceso, visto desde cada lado. Avanza etapa por etapa y las dos partes ven siempre en qué punto va.",
      tenantEyebrow: "Si buscas arriendo",
      tenantTitle: "Del inmueble a las llaves",
      tenantSteps: [
        "Busca en el catálogo y postúlate al inmueble que te sirve. Tu perfil se arma una sola vez y sirve para la siguiente postulación.",
        "Sube tus documentos e ingresos. El propietario los aprueba o te dice qué le falta, con el motivo escrito.",
        "Se acuerda una entrevista: el propietario propone día y canal, y tú confirmas. Sin confirmación no hay cita.",
        "Firmas el contrato con un código de un solo uso y transfieres el primer canon desde tu banco, con su soporte.",
      ] as readonly string[],
      tenantAction: "Ver inmuebles",
      landlordEyebrow: "Si tienes un inmueble",
      landlordTitle: "De la publicación al primer canon",
      landlordSteps: [
        "Publica gratis. La dirección exacta y la matrícula inmobiliaria quedan privadas: el aviso muestra el barrio y una zona, nunca el punto.",
        "Recibe postulaciones con el perfil completo del inquilino y revísalo aquí mismo, documento por documento.",
        "Consulta los antecedentes con la autorización del inquilino, haz la entrevista y define si va con póliza de arrendamiento.",
        "Sube el contrato, ambos firman en línea y confirmas el primer canon cuando llegue a tu cuenta. Ahí empieza el arriendo.",
      ] as readonly string[],
      landlordAction: "Publicar inmueble",
      afterSigning:
        "Después de la firma el arriendo sigue aquí: mes a mes, con el soporte de cada pago y los arreglos que el inquilino reporta. Esta plataforma no recibe ni transfiere el dinero — el pago va directo del inquilino al propietario y aquí queda el registro.",
    },

    cities: {
      title: "Vive donde quieres vivir",
      body: "Estas son las ciudades donde hay inmuebles publicados hoy. El número es real y cambia con el catálogo.",
      /** Spelled out per number: "1 inmuebles" reads as a site nobody maintains. */
      count: (count: number) => (count === 1 ? "1 inmueble" : `${count} inmuebles`),
    },

    showcase: {
      title: "Recién publicados",
      body: "El precio que ves es el total: canon más administración.",
      seeAll: "Ver todo el catálogo",
    },

    closing: {
      title: "Tu próximo arriendo empieza con una conversación directa",
      body: "Crear la cuenta es gratis, para las dos partes. Publicar también.",
      search: "Buscar inmueble",
      publish: "Publicar mi inmueble",
      talkToSomeone: "Habla con una persona",
    },
  },

  /**
   * The catalogue's own SEO copy, consumed by `features/property/domain/seo.ts`.
   *
   * It lives in the dictionary rather than in that module because it is copy, and it stays a
   * *function of the city* because the sentence puts the city in a different place in each language
   * — which is exactly what a template with a `{city}` placeholder cannot express.
   */
  propertySeo: {
    catalogTitle: (city: string | null) =>
      city ? `Arriendos en ${city}` : "Inmuebles en arriendo en Colombia",
    catalogDescription: (city: string | null) =>
      `Apartamentos, casas y apartaestudios en arriendo ${city ? `en ${city}` : "en toda Colombia"}, ` +
      "por 6 o 12 meses y directamente con el propietario. Sin intermediarios y sin comisión de inmobiliaria.",
  },

  /**
   * The chrome of a notification email: everything around the sentence the notification itself
   * carries. **The per-type sentences are still Spanish only** — they live in
   * `features/notification/domain/notification.ts` and there are forty-six of them, each written to
   * say which of two things happened; see the report.
   */
  email: {
    viewProcess: "Ver el proceso",
    viewLease: "Ver el arriendo",
    linkFallback: "Si el botón no funciona, copia este enlace:",
    why: (brand: string) => `Recibes este correo porque haces parte de un proceso de arriendo en ${brand}.`,
  },

  /**
   * The one notice that only ever renders in English, and it is here rather than only in `en.ts`
   * because the dictionary's contract is that both files hold the same keys — a key that existed in
   * one and not the other is precisely what the `Dictionary` annotation exists to reject.
   */
  legal: {
    spanishOnlyHeading: "Este documento está en español",
    spanishOnlyBody:
      "Es el texto que rige. Traducirlo produciría un segundo documento, y sobre datos personales y condiciones de uso lo que vale es el que revisó un abogado.",
  },

  /**
   * Everything the public half of the catalogue says about a listing.
   *
   * **The label maps live here now**, not as `PROPERTY_TYPE_LABELS` beside the type. The keys stay
   * English because they are stored values; only the words moved. `features/property/domain/labels.ts`
   * resolves them into the plain `Record`s the UI reads — plain, because two of the readers are
   * Client Components and a `Record<string, string>` crosses the RSC boundary while a function does
   * not.
   *
   * The SEO sentences are functions taking the already-formatted pieces, so the **ladder stays in
   * the domain and only the phrasing is here**: `propertyMetaTitle` still decides that the price
   * goes first and the city never goes, which is what `seo.test.ts` pins.
   */
  property: {
    types: {
      apartment: "Apartamento",
      house: "Casa",
      studio: "Apartaestudio",
      retail: "Local",
      office: "Oficina",
    },
    statuses: {
      draft: "Borrador",
      available: "Disponible",
      rented: "Arrendado",
      inactive: "Inactivo",
    },
    /** Long-term only. "1 año" rather than "12 meses": it is how the term is actually spoken. */
    lease: { 6: "6 meses", 12: "1 año" },
    parking: {
      private: "Tiene parqueadero",
      communal: "Parqueadero comunitario",
      none: "No tiene parqueadero",
    },
    features: {
      furnished: "Amoblado",
      pets: "Acepta mascotas",
      parking: "Con parqueadero",
    },
    sorts: {
      recent: "Más recientes",
      "price-asc": "Precio (menor a mayor)",
      "price-desc": "Precio (mayor a menor)",
    },
    /** The last bucket is open-ended: past three, "cuatro o más" is what a tenant means. */
    bedroomBucket: (bucket: number, isMax: boolean) =>
      isMax ? `${bucket} o más` : bucket === 1 ? "1 habitación" : `${bucket} habitaciones`,

    filterType: "Tipo de inmueble",
    filterBedrooms: "Habitaciones",
    filterTerm: "Duración mínima",
    filterFeatures: "Características",
    filtersTitle: "Filtros",
    anyCity: "Todas las ciudades",
    sortBy: "Ordenar",
    found: (total: number) =>
      total === 1 ? "1 inmueble encontrado" : `${total} inmuebles encontrados`,
    noMatch: "Ningún inmueble coincide",
    clearFilters: "Quitar filtros",

    furnished: "Amoblado",
    notFurnished: "Sin amoblar",
    petsAllowed: "Acepta mascotas",
    noPets: "Sin mascotas",
    minimumTerm: (term: string) => `Mínimo ${term}`,
    seeProperty: "Ver inmueble",

    noPhotos: "Sin fotos",
    stratum: (n: number) => `Estrato ${n}`,
    rentPlusAdmin: (rent: string, admin: string) => `Canon ${rent} + administración ${admin}`,
    availableFrom: "Disponible desde",
    rentPlusAdminShort: (rent: string, admin: string) => `${rent} + ${admin} de administración`,
    apply: "Postularme",
    ownListing: "Este inmueble es tuyo. Las postulaciones que reciba las verás en Arriendos.",
    seeMyProcess: "Ver mi proceso",
    seeMyApplication: "Ver mi postulación",
    applicationRejected: "El propietario no continuó con tu postulación a este inmueble.",
    backToProperties: "Volver a los inmuebles",
    ownerOnlyStatus: "solo tú puedes verlo",
    ownerOnlyPrefix: "Este anuncio está en",
    moreRentalsIn: (city: string) => `Ver más arriendos en ${city}`,
    registryNumber: "matrícula",
    ownerOnlyAddress:
      "— solo lo ves tú. El inquilino recibe la dirección cuando apruebes su postulación.",
    aboutTheProperty: "Sobre el inmueble",

    /*
      El video del anuncio. `videoOf` es una función y por eso esta namespace es server-only: la
      página resuelve el nombre accesible y le pasa la cadena terminada al reproductor, que es un
      Server Component sin una línea de JavaScript.

      La nota del respaldo se dice siempre, no solo cuando falla: un navegador que no puede
      decodificar el archivo muestra un reproductor vacío y no avisa de nada, así que la salida
      tiene que estar visible antes de que se necesite.
    */
    videoHeading: "Video del inmueble",
    videoOf: (title: string) => `Video de ${title}`,
    videoBadge: "Con video",
    videoFallbackNote: "¿No se reproduce?",
    videoFallbackAction: "Abrir el archivo",
    locationDisclaimer:
      "Por seguridad, la dirección exacta se comparte con el inquilino cuando el propietario aprueba su postulación.",
    forRent: (what: string) => `${what} en arriendo`,
    monthlyRent: "Canon mensual",
    noAdminFee: "Sin cuota de administración",
    adminIncluded: "Administración incluida",
    minimumTermLabel: "Duración mínima",
    location: "Ubicación",
    needAccount: "Necesitas una cuenta para postularte. Es gratis y toma un minuto.",
    applyingCommitsNothing:
      "Postularte no te compromete a nada: el propietario decide y tú también.",

    unavailableTitle: "Inmueble no disponible",
    ogFallbackAlt: "Inmueble en arriendo en miarriendoDIRECTO.com",

    bedroomsFact: (count: number) =>
      count === 0 ? "sin habitación separada" : count === 1 ? "1 habitación" : `${count} habitaciones`,
    bathroomsFact: (count: number) => (count === 1 ? "1 baño" : `${count} baños`),
    seoTitle: (what: string, where: string, price: string | null) =>
      price ? `${what} en arriendo en ${where} · ${price}` : `${what} en arriendo en ${where}`,
    seoDescription: (what: string, where: string, price: string, facts: string) =>
      `${what} en arriendo en ${where} por ${price} al mes. ${facts}. ` +
      "Trato directo con el propietario, sin comisión de inmobiliaria.",
    imageAlt: (what: string, where: string) => `${what} en arriendo en ${where}`,
  },

  catalog: {
    titleDefault: "Encuentra tu próximo hogar",
    titleInCity: (city: string) => `Arriendos en ${city}`,
    body: "Directamente con el propietario, por 6 o 12 meses. Sin intermediarios y sin comisión de inmobiliaria.",
    loading: "Cargando los inmuebles…",
    filtersAriaLabel: "Filtros",
    paginationAriaLabel: "Paginación",
    previous: "Anteriores",
    next: "Siguientes",
    pageOf: (page: number, pages: number) => `Página ${page} de ${pages}`,
    emptyFiltered:
      "Ningún inmueble coincide con lo que buscas. Prueba quitando un filtro: puede que el tuyo esté a una cuadra.",
    emptyCatalog: "Todavía no hay inmuebles publicados. Vuelve pronto: los propietarios están llegando.",
    clearFilters: "Quitar filtros",
  },
} ;

/**
 * The shape of a language. Every locale's file is annotated with it, which is what makes a missing
 * translation a build failure instead of an `undefined` on somebody's screen.
 */
export type Dictionary = typeof es;
