import type { Dictionary } from "./es";

/**
 * English, annotated with the Spanish file's shape.
 *
 * **The annotation is the whole guarantee.** A key added to `es.ts` and forgotten here fails
 * `pnpm typecheck`; a key removed there and left here fails too. Nothing falls back silently, which
 * is deliberate — a fallback would mean an English reader gets a Spanish sentence with no signal to
 * anybody that a translation is missing, and that is the failure mode nobody notices until a user
 * reports it.
 *
 * **What is translated and what is not.** The product's own voice is translated. What stays in
 * Spanish, everywhere and on purpose:
 *
 * - **URLs.** `/inmuebles`, `/contratos`. They are the project's documented exception, every link
 *   already sent points at them, and `propertySlugs/{slug}` mints Spanish slugs from Spanish titles.
 * - **Proper nouns and user content.** `Bogotá D.C.`, an address, a landlord's own headline, the
 *   department names out of DANE.
 * - **The three legal documents.** `/terminos`, `/privacidad` and `/cookies` are operative under
 *   Ley 1581 and Ley 1480, and a translated policy is a second policy — one a lawyer has not read.
 *   Their *links* are translated; their text is not. See the report.
 *
 * Colombian specifics are kept rather than localised away: "canon" is the legal word for the monthly
 * rent and "administración" is a real line item on a Colombian lease, so both are explained in
 * English rather than replaced by an American equivalent that would describe a different thing.
 */
export const en: Dictionary = {
  common: {
    comingSoon: "Coming soon",
    countryCode: "Country code",
    country: "Country",
    opensInNewTab: "(opens in a new tab)",
    loading: "Loading…",
    save: "Save",
    perMonth: "per month",
  },

  language: {
    label: "Language",
  },

  authErrors: {
    invalidCredential: "Incorrect email or password",
    userDisabled: "This account is disabled. Write to us to reactivate it.",
    emailInUse: "An account with this email already exists. Sign in.",
    weakPassword: "That password is too weak. Use at least 8 characters.",
    tooManyRequests: "Too many failed attempts. Wait a few minutes and try again.",
    networkFailed: "No connection. Check your internet and try again.",
    popupClosed: "You closed the Google window before finishing.",
    popupBlocked: "Your browser blocked the Google window. Allow pop-ups.",
    accountExistsOtherCredential:
      "An account with this email already exists. Sign in with email and password.",
    operationNotAllowed: "This sign-in method is not enabled. Write to us and we will help.",
    unauthorizedDomain: "This domain is not authorised for sign-in.",
    fallback: "We could not complete the operation. Try again.",
  },

  nav: {
    comingSoon: "Coming soon",
    mainNav: "Main navigation",
    home: "Home",
    myProperties: "My properties",
    contracts: "Contracts",
    rentals: "Rentals",
    tenantProfile: "Tenant profile",
    tenantProfileShort: "My profile",
    errands: "Errands",
    verifications: "Verifications",
    support: "Support",
    settings: "Settings",
    soon: "Soon",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    expand: "Expand the menu",
    collapse: "Collapse the menu",
    myPortal: "My portal",
    myProfile: "My profile",
    signOut: "Sign out",
    signingOut: "Signing out…",
  },

  auth: {
    email: "Email address",
    emailPlaceholder: "you@example.com",
    emailPlaceholderAlt: "you@example.com",
    password: "Password",
    passwordPlaceholder: "••••••••",
    signIn: "Sign in",
    signingIn: "Signing in…",
    creatingAccount: "Creating your account…",
    or: "or",
    continueWithGoogle: "Continue with Google",
    requirementMet: "(met)",
    requirementPending: "(pending)",
    quickStep: "It only takes a minute.",

    forgotPassword: "Forgot your password?",
    noAccount: "No account yet?",
    createFree: "Create one free",
    back: "Back",
    createAccountTitle: "Create an account",
    continueWithEmail: "Continue with email",
    createAccount: "Create account",
    nextStepAsks: "On the next step we will ask you to accept the",
    andAuthorize: "and to authorise the processing of your data.",
    termsLink: "Terms and conditions",
    panelLoginLead: "Connect. Manage.",
    panelLoginAccent: "Get it right.",
    panelResetLead: "Back in,",
    panelResetAccent: "with nothing lost.",
    panelConfirmLead: "Almost there.",
    panelConfirmAccent: "Choose your password.",

    welcomeBack: "Welcome back",
    enterCredentials: "Enter your credentials to reach your portal.",
    completeProfileHeading: "Complete your profile",
    completeProfileNote:
      "We need these details to verify your identity and prepare your contracts.",
    checkYourEmail: "Check your email",
    resetSentToBefore: "If an account exists for",
    resetSentToAfter:
      ", we have sent it a link to choose a new password. It expires in an hour and works once.",
    resetNotArrived:
      "Did it not arrive? Check your spam folder. If the address is not registered you will receive nothing — that is how we avoid confirming to anybody whether you have an account here.",
    backToSignIn: "Back to sign in",
    resetFormNote: "Type your account's email and we will send a link to choose a new one.",
    sendLink: "Send the link",
    sendingLink: "Sending…",

    checkingLink: "Checking the link…",
    linkDead: "This link does not work",
    linkDeadNote: "This link no longer works: it may have expired or been used. Request a new one.",
    savePassword: "Save the password",
    savingPassword: "Saving…",
    changePassword: "Change password",
    changingPassword: "Changing…",
    passwordChanged: "Password updated",
    passwordChangedNote:
      "You can now sign in with your new password. If you were signed in on another device, you will have to sign in again there.",
    howYouSignIn: "How you sign in",
    changeYourPassword: "Change your password",
    changeYourPasswordNote:
      "We ask for the current one: without it, anybody who finds your session open could take the account.",
    yourPassword: "Your password",
    noPasswordHere:
      "You have no password on this product: you sign in with Google, and Google manages both the password and two-step verification.",
    signOutEverywhereTitle2: "Sign out everywhere",
    signOutEverywhereNote:
      "If you think somebody else got into your account, this invalidates every open session. This device's included.",
    signOutEverywhereButton: "Sign out on every device",
    securityUnavailable:
      "We could not read your account's status right now. Reload the page in a while; your notification preferences keep working.",
    loginTitle: "Sign in",
    loginMeta:
      "Sign in to your miarriendoDIRECTO.com portal to manage your properties, applications and payments.",
    loginPanel:
      "Deal directly with the landlord or the tenant, verify profiles in minutes, and run every stage of your contract in one place.",

    signupMeta:
      "Create your miarriendoDIRECTO.com account and rent with no middlemen and no needless paperwork.",
    welcome: "Welcome",
    signupPanel: "Create your account and join the new way to rent, without needless paperwork.",

    resetTitle: "Recover your password",
    resetMeta:
      "We will email you a link to choose a new password for your miarriendoDIRECTO.com account.",
    resetHeading: "Forgot your password?",
    resetPanel:
      "Your properties, your applications and your contracts are where you left them. All you need is a new password.",

    newPasswordTitle: "Choose a new password",
    newPasswordMeta: "Finish recovering your miarriendoDIRECTO.com account.",
    newPasswordNote: "Once saved, you can sign in with it on any device.",
    newPassword: "New password",
    nothingToChange: "There is nothing to change here",
    missingCode:
      "This screen needs the code from the recovery email. If you have just chosen your new password, it is already saved: sign in with it.",
    askNewLink: "Request a new link",

    completeProfileTitle: "Complete your profile",
    completeProfileMeta: "Fill in your details to start using miarriendoDIRECTO.com.",

    currentPassword: "Current password",
    wrongCurrentPassword: "That is not your current password.",

    providerEmailLabel: "Email and password",
    providerEmailNote: "You sign in with your email and a password you choose.",
    providerGoogleLabel: "Google",
    providerGoogleNote:
      "Google manages your password and two-step verification, so there is nothing to configure here.",
    providerPhoneLabel: "Code to your phone",
    providerPhoneNote: "You sign in with a one-time code, no password.",
    providerOtherLabel: "Another method",
    providerOtherNote: "Write to us if you want to change how you sign in.",
    emailVerified: "Email verified",
    yes: "Yes",
    notYet: "Not yet",
    lastSignIn: "Last sign-in",
    accountCreated: "Account created",

    signOutEverywhereTitle: "Sign out on every device?",
    signOutEverywhereBody:
      "You will be signed out of any browser or phone where you have signed in, including this one. You will need to sign in again.",
    signOutEverywhereConfirm: "Sign out everywhere",
    signOutEverywherePending: "Signing out…",
  },

  support: {
    writeOnWhatsApp: "Message us on WhatsApp",
    sendEmail: "Send an email",
    copyEmail: "Copy the address",
    emailCopied: "Address copied",
    copiedToClipboardAfter: "copied to the clipboard",
    copyFailed: "We could not copy it. The address is",
    opensInNewTab: "(opens in a new tab)",
    team: "Support team",
    greetingBefore: "Hello",
    greetingAfter: " — write to us if you have questions about your rental, your contract or your payments.",
    whatsappLabel: "WhatsApp:",
    emailLabel: "Email:",
    seeSupportPage: "Go to the support page",
  },

  propertyForm: {
    /** The card's link to the rental notice. Only on a published listing: see `posterBlocker`. */
    notice: "Notice",
    sectionProperty: "The property",
    sectionFeatures: "Features",
    sectionLocation: "Location",
    sectionTerms: "Terms",
    sectionPhotos: "Photos",

    title: "Listing title",
    titlePlaceholder: "Bright apartment in Palermo",
    description: "Description",
    descriptionPlaceholder:
      "Tell the tenant what the property is like, what it includes and what is nearby.",
    type: "Property type",
    typePlaceholder: "Choose the type",

    area: "Floor area (m²)",
    /* Colombia's socio-economic band, 1-6: it sets the utility tariffs, so the word is kept. */
    stratum: "Stratum",
    select: "Choose",
    bedrooms: "Bedrooms",
    bathrooms: "Bathrooms",
    parking: "Parking",
    furnished: "Furnished",
    petsAllowed: "Pets allowed",

    department: "Department",
    departmentPlaceholder: "Choose the department",
    city: "City",
    neighborhood: "Neighbourhood",
    address: "Street address",
    addressPlaceholder: "Calle 60 #10-20 apto 301",
    addressTooltip:
      "Only the tenant whose application you approve sees it. The listing shows the neighbourhood and the city.",
    /* `matrícula inmobiliaria` is Colombia's property registry number; there is no English term. */
    registryNumber: "Property registry number (matrícula inmobiliaria)",
    registryPlaceholder: "050-123456",
    registryTooltip:
      "The number on the certificado de tradición, issued by the Oficina de Registro de Instrumentos Públicos. It is not published: it identifies the property to the registry.",

    rent: "Monthly rent (COP)",
    rentPlaceholder: "1.800.000",
    adminFee: "Building fee (COP)",
    adminFeeHint: "Write 0 if the property pays no building fee.",
    availableFrom: "Available from",
    minLease: "Minimum term",
    minLeasePlaceholder: "Choose the term",

    copyLink: "Copy link",
    linkCopied: "Link copied",
    copyLinkFailed: "Your browser would not let us copy the link. Open it and copy it from the bar.",
    deleteFailed: "We could not delete the property.",
    deleteTitle: "Delete this property?",
    deleteBefore: "This deletes",
    deleteAfter: "along with its photos, and its link stops working. It cannot be undone.",
    deleteConfirm: "Delete property",

    addPhotos: "Add photos",
    addMorePhotos: "Add more photos",
    uploadingPhotos: "Uploading…",
    uploadingPhotosStatus: "Uploading the photos.",
    photoSessionExpired: "Your session expired. Sign in again to upload photos.",
    photoUploadFailed: "We could not upload the photos. Check your connection and try again.",
    removePhotoTitle: "Remove this photo?",
    removePhotoBody:
      "It stops showing on the listing and is deleted when you save. It cannot be undone.",
    removePhotoConfirm: "Remove photo",
    removePhotoPending: "Removing…",

    /* One video per listing: see the Spanish note. MP4 first for the same reason. */
    videoLabel: "Property video",
    videoOptional: "Optional",
    addVideo: "Add a video",
    changeVideo: "Change the video",
    removeVideo: "Remove video",
    uploadingVideo: "Uploading…",
    uploadingVideoStatus: "Uploading the video.",
    videoPreviewLabel: "Preview of the video you uploaded",
    videoHint:
      "A short walkthrough shows what photos cannot: how the rooms connect and how much light gets in. MP4, MOV or WEBM, up to 50 MB. MP4 plays on every device.",
    videoTooLarge: "That video is over 50 MB. Trim it or record a shorter one.",
    videoUnsupported: "MP4, MOV or WEBM only.",
    videoEmpty: "That file is empty.",
    videoUploadFailed: "We could not upload the video. Check your connection and try again.",
    videoRejected:
      "The server would not accept that file. Check that it is MP4, MOV or WEBM and under 50 MB.",
    videoSessionExpired: "Your session expired. Sign in again to upload the video.",
    removeVideoTitle: "Remove this video?",
    removeVideoBody:
      "It stops showing on the listing and is deleted when you save. It cannot be undone.",
    removeVideoConfirm: "Remove video",
    removeVideoPending: "Removing…",

    mapLabel: "Location on the map",
    mapHintField: "the location on the map",
    mapHintBefore: "The listing publishes an area of about",
    mapHintAfter:
      "metres across, never this point: the exact location is yours alone, like the street address.",
    optional: "(optional)",
    mapInstructions: "Move the map until the crosshair sits over the property. With the keyboard: arrows to move,",
    mapInstructionsZoom: "to zoom.",
    zoomIn: "Zoom in further to mark the property.",
    centerOnNeighborhood: "Centre on the neighbourhood",
    searchingNeighborhood: "Looking up the neighbourhood…",
    pointMarked: "Point marked:",
    noPoint: "No point on the map. You can publish without marking it.",


    saveDraft: "Save as draft",
    savingDraft: "Saving draft…",
    draftHint:
      "No photos yet? Save the draft with everything else: only you can see it, and from your list you can send somebody to take them.",
    publishDraft: "Publish",
    publishingDraft: "Publishing…",
    publishDraftNoPhotos: "Add at least one photo before publishing it.",
    publishDraftFailed: "We could not publish the property.",

    publish: "List property",
    publishing: "Publishing…",
    saveChanges: "Save changes",
    saving: "Saving…",
  },

  portal: {
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    welcomeBackBefore: "Welcome back",
    shortcutsAria: "Shortcuts and help",
    lookingForHome: "Looking for a new home?",
    browseProperties: "Browse the available properties",
    tip: "Tip",
    tipBody:
      "Have your ID document and your employment letter to hand: with your paperwork in order, an application is approved in minutes.",
    homeTitle: "Home",
    homeMeta: "Your miarriendoDIRECTO.com portal.",

    myPropertiesTitle: "My properties",
    myPropertiesMeta: "Manage the properties you listed on miarriendoDIRECTO.com.",
    nonePublishedYet: "You have not listed any yet.",
    publishedCount: (n: number) => `${n} listed.`,
    myPropertiesEmpty:
      "List your first property and share it: the tenant applies directly to you, with no middlemen.",

    contractsTitle: "Contracts",
    contractsMeta: "The processes under way and the ones already closed, stage by stage.",
    contractsOpen: (n: number) => `Contracts under way (${n})`,
    contractsClosed: (n: number) => `Closed processes (${n})`,
    contractsIntro: "Every rental, from application to signature. Both parties see it here.",
    contractsEmpty:
      "No rental under way yet. Start by applying to a property, or wait for somebody to apply to yours.",
    seeProperties: "Browse properties",
    fillTenantProfile: "Fill in my tenant profile",

    rentalsTitle: "Rentals",
    rentalsMeta: "The tenancies under way, month by month: what has been paid and what is left.",
    rentalsIntro: "The tenancies already running, month by month. Both parties see it here.",
    rentalsLoadFailed: "We could not load your tenancies",
    rentalsLoadFailedBody:
      "That was our problem, not yours, and nothing happened to your information. Reload the page in a moment; if it stays the same, write to us.",
    retry: "Try again",
    writeToSupport: "Write to support",
    rentalsEmpty:
      "You have no tenancy under way yet. One starts here when the process reaches its last stage and the landlord confirms the first month's rent.",
    seeMyContracts: "View my contracts",

    yourDetails: "Your details",
    yourDetailsNote: "This is what the other party in a process sees. The same details appear in",
    personalDetails: "Your personal details",
    tenantProfileIntro:
      "What a landlord needs to know about you. It is saved once and travels with you to every application; you can review it there before sending it.",
    errandsTitle: "Errands",
    errandsIntro: "What you asked somebody else to do about your properties, and where each one is.",
    newErrand: "New errand",
    createErrand: "Create an errand",
    errandsEmpty:
      "You have not delegated anything yet. You can create one here, or from the \u201cDelegate\u201d button on any of your properties.",
    errandLate: " · past the date",
    errandDeclined: "Could not:",
    errandCompleted: "Reported:",
    errandCancelled: "You cancelled it:",
    settingsTitle: "Settings",
    settingsMeta: "Your details, your notifications and how you sign in.",
    settingsIntro: "Your details, what we notify you about, and how you sign in.",
    emailNotEditable: "The email comes from how you sign in and is not edited here.",
    sameAsBefore: "your tenant profile",
    sameAsAfter: ": changing them in either place changes them in the other.",

    tenantProfileTitle: "Tenant profile",
    tenantProfileMeta: "The details you send with every application, saved once.",
    tenantProfilePrivate: "Nobody but you can see this page",
    tenantProfilePrivateAfter:
      ": a landlord only receives a copy when you apply to their property.",
  },

  dossier: {
    documentTypes: {
      /* Colombia's national ID for citizens and for foreign residents; the names are the legal ones. */
      cc: "Cédula de ciudadanía (national ID)",
      ce: "Cédula de extranjería (foreign resident ID)",
      passport: "Passport",
    },
    occupations: {
      employee: "Employee",
      self_employed: "Self-employed",
      business_owner: "I own a business",
      student: "Student",
      retired: "Retired",
    },
    employerLabels: {
      employee: "Where you work",
      self_employed: "What you do",
      business_owner: "Your business",
      student: "Where you study",
      retired: "Where your pension comes from",
    },
    documentLabels: {
      id_front: "ID, front",
      id_back: "ID, back",
      id_both: "ID (both sides)",
      employment_letter: "Employment letter",
      payslip: "Payslips",
      /* The RUT and the Cámara de Comercio certificate are Colombian documents by name. */
      rut: "RUT (tax ID)",
      tax_return: "Tax return",
      bank_statement: "Bank statements",
      chamber_of_commerce: "Cámara de Comercio certificate",
      pension_certificate: "Pension certificate",
      pension_payslip: "Pension payslips",
      study_certificate: "Enrolment certificate",
    },
    documentHints: {
      id_front: "The photo or scan of the front, legible and complete.",
      id_back: "The back of the same document.",
      id_both: "A single file with both sides, as a scanner produces it.",
      employment_letter: "With your role, your salary, how long you have been there and your contract type.",
      payslip: "The last three, one per file.",
      rut: "The one issued by the DIAN, up to date.",
      tax_return: "Only if you file taxes. If you do not, leave it empty.",
      bank_statement: "The last three months, one per file.",
      chamber_of_commerce: "The certificate of existence, renewed this year.",
      pension_certificate: "The resolution or certificate for your pension.",
      pension_payslip: "The last three, one per file.",
      study_certificate: "The one your university or institute issues, for the current term.",
    },

    previewOf: "Preview of",
    uploading: "Uploading",
    file: "file",
    of: "of",
    chooseOneMasc: "Choose one",
    occupation: "Occupation",
    monthlyIncome: "Monthly income (COP)",
    referenceRelationHint: "Manager, previous landlord, colleague…",
    uploadAgain: " Upload it again.",
    removeDocumentBefore: "This deletes",
    removeDocumentAfter: "and you will have to upload it again. It cannot be undone.",
    removeDocumentConfirm: "Remove document",
    removeDocumentPending: "Removing…",
    whoYouAre: "Who you are",
    documentType: "Document type",
    documentNumber: "Document number",
    chooseOne: "Choose one",
    howYouEarn: "How you earn",
    monthlyIncomeHint: "What you receive a month, before deductions.",
    household: "People who would live there",
    pets: "Pets",
    hasPets: "I have pets",
    tellTheLandlord: "Tell the landlord",
    petsHint:
      "How many, what kind and what size. It is the most common reason an application is turned down: saying it up front works in your favour.",
    reference: "Personal reference",
    referenceIntro:
      "Somebody who can vouch for you. Not a co-signer: the guarantee is decided later.",
    referenceName: "Your reference's name",
    referenceRelation: "How you know each other",
    referencePhone: "Your reference's phone",
    referenceAuthorized:
      "This person knows I am going to give their name and phone number, and authorised me to do so.",

    yourDetails: "Your details",
    yourDetailsNote: "The ones you gave when you created your account. Correct them here if anything changed.",
    saveMyDetails: "Save my details",
    savedConfirmation: "Done, your details are saved.",

    uploadSessionExpired: "Your session expired. Sign in again to upload your documents.",
    uploadFailed: "We could not upload the file. Check your connection and try again.",
    landlordRejected: "The landlord did not accept it.",
    removeDocumentTitle: "Remove this document?",
    idInOneFile: "My ID is in a single file, with both sides",
    ifApplicable: "If applicable",
    rejected: "Rejected.",
    remove: "Remove",
  },

  notify: {
    documentIs: (label: string) => `The document is: ${label}.`,
  },

  application: {
    stageLabels: {
      submitted: "Application received",
      visit: "Property viewing",
      tenant_data: "Tenant's details and documents",
      background_check: "Background checks",
      interview: "Interview with the landlord",
      /* "Póliza de arrendamiento" is Colombia's rental insurance policy — it replaces a co-signer. */
      guarantee: "Rental insurance policy",
      contract_signature: "Contract signature",
      /* "Canon" is the legal word for the monthly rent on a Colombian lease. */
      first_payment: "First month's rent",
    },
    stageDescriptions: {
      submitted: "The landlord has your application and the details you declared.",
      visit:
        "Go and see the property. The landlord proposes the day and the meeting point, and then you tell us whether you are interested.",
      tenant_data: "Upload your ID document and proof of your income.",
      background_check:
        "With your authorisation, your judicial record, traffic fines and disciplinary sanctions are checked.",
      interview:
        "The landlord will propose a time to talk with you for 30 minutes. Confirm it here and you are set.",
      guarantee:
        "The landlord takes out a rental insurance policy with Sura. You need no co-signer.",
      contract_signature: "Sign the lease, for 6 or 12 months.",
      first_payment:
        "Pay the first month's rent and upload the receipt. As soon as the landlord confirms it arrived, the process ends and the tenancy begins.",
    },
    stageDescriptionsLandlord: {
      submitted: "Review what the tenant declared and decide whether to continue with them.",
      visit:
        "Propose a day and a meeting point so the tenant can see the property. They will say whether they are interested.",
      tenant_data: "Ask them for their ID document and proof of their income.",
      background_check:
        "Check their judicial, traffic and disciplinary records, and record the result.",
      interview:
        "Propose a time to talk with the tenant for 30 minutes and, afterwards, write down here how it went.",
      guarantee:
        "Take out the rental insurance policy with Sura — no co-signer — and record its number here.",
      contract_signature: "Sign the lease, for 6 or 12 months.",
      first_payment:
        "Confirm you received the first month's rent: that ends the process and starts the tenancy.",
    },
    statusLabels: {
      open: "In progress",
      rejected: "Rejected",
      withdrawn: "Withdrawn",
    },

    stageWord: "Stage",
    stageDone: "complete",
    stageCurrent: "in progress",
    stagePending: "pending",
    advanceTo: "Continue to",
    completedLabel: "Tenancy under way",
    completedDescription:
      "The process is over and the tenancy is under way. Your payments and your contract now live under Rentals.",
    completedDescriptionLandlord:
      "The process is over and the tenancy is under way. The payments and the contract now live under Rentals.",
    processCompleted: "Process complete",
    stepOf: "Step",
    stepOfSeparator: "of",
    closedAtStage: "at the stage",
  },

  visit: {
    outcomes: {
      interested: "I am interested in the property",
      not_interested: "I am not interested in the property",
    },
    states: {
      none: "Not scheduled",
      proposed: "Awaiting confirmation",
      declined: "Another day is needed",
      confirmed: "Scheduled",
      interested: "Visited · interested",
      not_interested: "Visited · not interested",
    },
    blockers: {
      notProposedLandlord: "Propose a day and a meeting point for the viewing before continuing.",
      notProposedTenant: "The landlord has not proposed a day to see the property yet.",
      notConfirmedLandlord: "The tenant has not confirmed the day of the viewing yet.",
      notConfirmedTenant: "Confirm the day of the viewing so the process can move on.",
      noVerdictLandlord: "After the viewing, the tenant has to say whether they are interested.",
      noVerdictTenant: "After the viewing, tell us whether you are interested so we can continue.",
      notInterestedLandlord:
        "The tenant was not interested in the property, so the process does not continue. You can reject the application or propose another viewing.",
      notInterestedTenant:
        "You said you are not interested in the property, so the process does not continue. If you have changed your mind, update it here; if not, you can withdraw your application.",
    },

    saveFailed: "We could not save the change.",
    proposeIntroLandlord:
      "Propose a day and a meeting point so the tenant can go and see the property.",
    proposeIntroTenant:
      "The landlord will propose a day for you to see the property. We will tell you here and by email.",
    proposeTitle: "Propose the viewing",
    proposeAnotherTitle: "Propose another day for the viewing",
    proposeAnother: "Propose another day",
    noDay: "No day",
    tenantDeclined: "That day does not work for the tenant.",
    youAskedAnother: "You asked for another day.",
    tenantInterested: "The tenant is interested in the property",
    tenantNotInterested: "The tenant is not interested in the property",
    confirmVisit: "Confirm the viewing",
    cantThatDay: "I cannot make that day",
    whichDayWorks: "Which day works for you?",
    sendAndAskAnother: "Send and ask for another day",
    cancel: "Cancel",
    weToldTheLandlord:
      "We have told the landlord that day does not work for you. They will write with another.",
    awaitingTenant: "The tenant has not confirmed the day yet. We will tell you as soon as they answer.",
    changeMyAnswer: "Change my answer",
    changeYourAnswer: "Change your answer",
    afterTheVisit: "After the viewing",
    interested: "I am interested",
    saving: "Saving…",
    confirming: "Confirming…",
    sending: "Sending…",
    proposeAndNotify: "Propose and notify the tenant",
    notInterested: "Not interested",

    date: "Date",
    /* The time is always Colombian: the property is there, whoever is reading. */
    time: "Time (Colombia)",
    meetingPoint: "Meeting point",
    meetingPointHint:
      "Only the tenant on this application sees it, on this page: it never leaves in an email.",
    meetingPointPlaceholder: "Cra 23 #14-08, gate of tower 2",
    message: "Message (optional)",
    messagePlaceholder: "Ring flat 502. There is visitor parking.",
    whatYouThought: "What you thought (optional)",
    whatYouThoughtHint:
      "The landlord reads it too. Without your answer the process cannot move on.",
    whatYouThoughtPlaceholder: "I liked the light, but the kitchen is small.",
    whichDayPlaceholder: "Saturday mornings.",
      unconfirmed: "Unconfirmed",
    visited: "Visited",
    confirmedBadge: "Confirmed",
    landlordWaitsVerdict:
      "When the tenant goes, they will say here whether they are interested. Without that the process cannot move on.",
},

  interview: {
    channels: {
      meet: "Google Meet video call",
      whatsapp: "WhatsApp video call",
      phone: "Phone call",
    },
    results: {
      went_well: "Went well",
      with_reservations: "With reservations",
    },
    states: {
      none: "Not scheduled",
      proposed: "Awaiting confirmation",
      declined: "Another time is needed",
      confirmed: "Scheduled",
      done: "Held",
    },
    blockers: {
      notProposedLandlord: "Propose a date and a time for the interview before continuing.",
      notProposedTenant: "The landlord has not proposed a date for the interview yet.",
      notConfirmedLandlord: "The tenant has not confirmed the proposed time yet.",
      notConfirmedTenant: "Confirm the proposed time so the process can move on.",
      noFeedbackLandlord: "After the interview, write down how it went so you can continue.",
      noFeedbackTenant: "The landlord has not recorded how the interview went yet.",
    },

    confirmedBadge: "Confirmed",
    noSlotBadge: "No time set",
    unconfirmedBadge: "Unconfirmed",
    minutes: "minutes",
    saveFailed: "We could not save the change.",
    whatsappNote: "The video call will be over WhatsApp, to the number you both registered.",
    phoneNote: "It will be a phone call to the number you both registered.",
    confirmSlot: "Confirm the time",
    proposeAnother: "Propose another time",
    proposeAnotherAction: "Propose another time",
    channelLabel: "How",
    channelPlaceholder: "Choose the channel",
    declineHint: "If it does not work, tell me which days you can.",
    declinePlaceholder: "Weekdays after 6 p.m.",
    howDidItGo: "How did it go?",
    chooseOption: "Choose an option",
    conclusionPlaceholder: "They will send last month's proof of income.",
    saveConclusion: "Save the conclusion",
    weToldTheLandlord:
      "We have told the landlord that time does not work for you. They will write with another.",
    confirmedNote:
      "You confirmed the interview. After you talk, the landlord will write here how it went.",
    joinCall: "Join the video call",
    whichSlotWorks: "Which time works for you?",
    sendAndAskAnother: "Send and ask for another time",
    cancel: "Cancel",
    cantThatTime: "I cannot make that time",
    date: "Date",
    time: "Time (Colombia)",
    meetingLink: "Meeting link",
    createMeet: "Create the meeting in Google Meet",
    message: "Message (optional)",
    afterTheInterview: "After the interview",
    conclusionLabel: "What came out of the conversation",
    conclusionHint: "The tenant reads it too. Without this the process cannot move on.",
    confirming: "Confirming…",
    sending: "Sending…",
    saving: "Saving…",
  },

  guarantee: {
    /* Sura is a Colombian insurer; the product keeps its own name. */
    product: "Digital rental insurance",
    coverages: {
      rent: "Payment of the rent if the tenant defaults.",
      adminFee: "Payment of the building fees.",
      assistance:
        "Home assistance: plumbing, electrics, locksmith, glass replacement, moving costs and legal advice by phone.",
    },
    states: {
      none: "Not requested",
      requested: "Under review",
      active: "Policy active",
      waived: "No policy, by the landlord's decision",
    },
    limitNoteBefore: "If a claim is made, cover continues until the property is returned or until the tenant pays what they owe, up to a maximum of",
    limitNoteAfter: "months. The policy has to be current and paid.",
    waivedNote:
      "Without a policy there is nothing standing behind the rent if the tenant defaults: the law forbids asking for a cash deposit, so the insurance is the only guarantee this process offers. You can switch it back on while the process is still at this stage.",
    waivedTenantNote:
      "The landlord decided not to require a rental insurance policy for this process. You have nothing to do: nobody will assess your profile for the insurance and Sura will not write to you.",
    blockers: {
      notRequestedLandlordBefore: "Apply for the rental insurance policy with",
      notRequestedLandlordAfter: "to continue, or mark this tenancy as going without one.",
      notRequestedTenant: "The landlord has not applied for the rental insurance policy yet.",
      notIssuedLandlord: "When Sura issues the policy, record its number here to continue.",
      notIssuedTenant: "The policy is under review. The landlord will record it here when Sura issues it.",
    },

    saveFailed: "We could not save the change.",
    goesWithPolicy: "This tenancy has a rental insurance policy",
    withoutPolicy: "No rental insurance policy",
    withoutPolicyByYou: "This tenancy goes without a rental insurance policy, by your decision at this stage.",
    noCosigner: "No co-signer",
    policy: "Policy",
    yourPart: "Your part of the insurance",
    seeQuoterData: "See the quoter's details",
    whatTheQuoterAsks: "What the quoter will ask you for",
    ofTheProperty: "About the property",
    ofTheTenant: "About the tenant",
    address: "Street address",
    adminFeeValue: "Building fee amount",
    contractLength: "Contract length",
    registryNumber: "Property registry number",
    documentType: "Document type",
    documentNumber: "Document number",
    email: "Email address",
    alreadyRequested: "I have applied; they are reviewing the case.",
    suraLinkForTenant: "Sura link for the tenant",
    noteForTenant: "Note for the tenant (optional)",
    policyNumber: "Policy number",
    registerPolicy: "Record the policy",
    policyActiveNext: "The policy is active. The next step is signing the contract.",
    copied: "Copied",
    copyAction: "Copy",
    copyByHand: "Copy it by hand",
    saving: "Saving…",
      lawDoesNotRequire:
      "The law does not require insurance. If you are going to rent without it, switch this off and the process continues without asking you for a policy.",
    quoterHint:
      "Copy it from here. The amounts copy without separators or a currency sign, as the form wants them.",
    monthlyRentValue: "Monthly rent amount",
    savedTenantSees: "Saved. The tenant can see it.",
    linkPromptBefore: "When you finish the quote,",
    linkPromptAfter: "gives you a link for the tenant. Paste it here: it saves itself and we tell them.",
    alwaysChoosePlanBefore: "Always choose the",
    planNote: "It is the one that covers the building fee and the home assistance.",
},

  metadata: {
    siteName: "miarriendoDIRECTO.com",
    defaultTitle: "miarriendoDIRECTO.com",
    defaultDescription:
      "Rent without middlemen: miarriendoDIRECTO connects landlords and tenants, verifies profiles, and handles contracts and payments in one place.",
    landingTitle: "miarriendoDIRECTO.com · Rent direct, no middlemen",
    landingDescription:
      "Rent straight from the landlord in Colombia: no agency commission and no co-signer. Verified profiles, a contract signed online, and every payment with its receipt.",
    landingOgDescription:
      "Rent straight from the landlord in Colombia: no agency commission and no co-signer.",
  },

  header: {
    homeAriaLabel: "miarriendoDIRECTO.com, home",
    sectionsAriaLabel: "Sections",
    properties: "Properties",
    howItWorks: "How it works",
    contact: "Contact",
    publishProperty: "List a property",
    signIn: "Sign in",
  },

  footer: {
    legalAriaLabel: "Legal information",
    terms: "Terms and conditions",
    privacy: "Data processing policy",
    cookies: "Cookies",
    contact: "Contact",
  },

  landing: {
    hero: {
      eyebrow: "Rent direct in Colombia",
      titleLead: "Rent direct.",
      titleAccent: "No middlemen.",
      body: "Talk straight to the landlord — no agency commission and no co-signer. Verified profiles, a contract signed online, and every payment with its receipt, all in one place.",
      landlordPrompt: "Have a property to rent out?",
      landlordLink: "List it free",
      cityLabel: "City",
      anyCity: "All cities",
      typeLabel: "Property type",
      anyType: "Any type",
      search: "Search",
    },

    why: {
      title: "Renting with fewer people in the middle",
      body: "Landlord and tenant deal with each other directly. What the platform adds is what gets lost in a WhatsApp thread: the backing, the contract, and a record of what was agreed.",
      noFeesTitle: "No middlemen, no commission",
      noFeesBody:
        "Listing is free and we charge no agency commission. The tenant transfers the rent straight to the landlord's account: this platform does not move the money, it documents it.",
      verifiedTitle: "Verified profiles, no co-signer",
      verifiedBody:
        "The tenant builds their profile once — documents, income and references — and the landlord reviews it here. A rental insurance policy replaces the co-signer, which is the requirement that stops most applications in Colombia.",
      contractTitle: "Contract signed online",
      contractBody:
        "Each party signs with a one-time code sent to the channel they already verified, and the signature is bound to that exact file: if the contract changes, the signatures stop standing on their own.",
    },

    how: {
      title: "How it works",
      body: "The same process, seen from each side. It moves one stage at a time, and both parties always see where it is.",
      tenantEyebrow: "If you are looking to rent",
      tenantTitle: "From the listing to the keys",
      tenantSteps: [
        "Search the catalogue and apply to the property that works for you. You build your profile once and it serves the next application too.",
        "Upload your documents and income. The landlord approves them or tells you what is missing, with the reason written down.",
        "You agree on an interview: the landlord proposes a day and a channel, and you confirm. Without a confirmation there is no appointment.",
        "You sign the contract with a one-time code and transfer the first month's rent from your own bank, with its receipt.",
      ],
      tenantAction: "Browse properties",
      landlordEyebrow: "If you have a property",
      landlordTitle: "From the listing to the first rent payment",
      landlordSteps: [
        "List it free. The exact address and the property registry number stay private: the listing shows the neighbourhood and an area, never the point.",
        "Receive applications with the tenant's full profile and review it right here, document by document.",
        "Run the background checks with the tenant's authorisation, hold the interview, and decide whether it goes with a rental insurance policy.",
        "Upload the contract, both parties sign online, and you confirm the first rent payment when it reaches your account. That is where the tenancy starts.",
      ],
      landlordAction: "List a property",
      afterSigning:
        "After signing, the tenancy carries on here: month by month, with the receipt for each payment and the repairs the tenant reports. This platform neither receives nor transfers the money — payment goes straight from tenant to landlord, and the record stays here.",
    },

    cities: {
      title: "Live where you want to live",
      body: "These are the cities with properties listed today. The number is real and changes with the catalogue.",
      count: (count: number) => (count === 1 ? "1 property" : `${count} properties`),
    },

    showcase: {
      title: "Just listed",
      body: "The price you see is the total: rent plus building fees.",
      seeAll: "See the whole catalogue",
    },

    closing: {
      title: "Your next rental starts with a direct conversation",
      body: "Creating an account is free, for both sides. So is listing.",
      search: "Find a property",
      publish: "List my property",
      talkToSomeone: "Talk to a person",
    },
  },

  propertySeo: {
    catalogTitle: (city: string | null) =>
      city ? `Rentals in ${city}` : "Properties for rent in Colombia",
    catalogDescription: (city: string | null) =>
      `Apartments, houses and studios for rent ${city ? `in ${city}` : "across Colombia"}, ` +
      "for 6 or 12 months and straight from the landlord. No middlemen and no agency commission.",
  },

  email: {
    viewProcess: "View the process",
    viewLease: "View the tenancy",
    linkFallback: "If the button does not work, copy this link:",
    why: (brand: string) => `You are receiving this email because you are part of a rental process on ${brand}.`,
  },

  legal: {
    spanishOnlyHeading: "This document is in Spanish",
    spanishOnlyBody:
      "It is the text that governs. Translating it would produce a second document, and where personal data and terms of use are concerned the one that counts is the one a lawyer reviewed.",
  },

  property: {
    types: {
      apartment: "Apartment",
      house: "House",
      studio: "Studio",
      retail: "Retail unit",
      office: "Office",
    },
    statuses: {
      draft: "Draft",
      available: "Available",
      rented: "Rented",
      inactive: "Inactive",
    },
    lease: { 6: "6 months", 12: "1 year" },
    parking: {
      private: "Has a parking space",
      communal: "Shared parking",
      none: "No parking",
    },
    features: {
      furnished: "Furnished",
      pets: "Pets allowed",
      parking: "With parking",
    },
    sorts: {
      recent: "Most recent",
      "price-asc": "Price (low to high)",
      "price-desc": "Price (high to low)",
    },
    bedroomBucket: (bucket: number, isMax: boolean) =>
      isMax ? `${bucket} or more` : bucket === 1 ? "1 bedroom" : `${bucket} bedrooms`,

    filterType: "Property type",
    filterBedrooms: "Bedrooms",
    filterTerm: "Minimum term",
    filterFeatures: "Features",
    filtersTitle: "Filters",
    anyCity: "All cities",
    sortBy: "Sort",
    found: (total: number) => (total === 1 ? "1 property found" : `${total} properties found`),
    noMatch: "No property matches",
    clearFilters: "Clear filters",

    furnished: "Furnished",
    notFurnished: "Unfurnished",
    petsAllowed: "Pets allowed",
    noPets: "No pets",
    minimumTerm: (term: string) => `${term} minimum`,
    seeProperty: "View property",

    /* "Canon" is the legal word for the monthly rent on a Colombian lease; "rent" is the English of it. */
    noPhotos: "No photos",
    /* "Estrato" is Colombia's socio-economic band, 1-6; it sets utility tariffs, so it is kept. */
    stratum: (n: number) => `Stratum ${n}`,
    rentPlusAdmin: (rent: string, admin: string) => `Rent ${rent} + building fee ${admin}`,
    availableFrom: "Available from",
    rentPlusAdminShort: (rent: string, admin: string) => `${rent} + ${admin} building fee`,
    apply: "Apply",
    ownListing: "This property is yours. Applications for it appear under Rentals.",
    seeMyProcess: "View my process",
    seeMyApplication: "View my application",
    applicationRejected: "The landlord did not continue with your application for this property.",
    backToProperties: "Back to properties",
    ownerOnlyStatus: "only you can see it",
    ownerOnlyPrefix: "This listing is",
    moreRentalsIn: (city: string) => `More rentals in ${city}`,
    /* The `matrícula inmobiliaria` is Colombia's property registry number; there is no English term. */
    registryNumber: "registry no.",
    ownerOnlyAddress:
      "— only you can see this. The tenant receives the address when you approve their application.",
    aboutTheProperty: "About this property",

    /* The listing's video. See the Spanish note: the fallback line is always shown, not only on
       failure, because a browser that cannot decode the file shows an empty player silently. */
    videoHeading: "Property video",
    videoOf: (title: string) => `Video of ${title}`,
    videoBadge: "Has video",
    videoFallbackNote: "Not playing?",
    videoFallbackAction: "Open the file",
    locationDisclaimer:
      "For safety, the exact address is shared with the tenant once the landlord approves their application.",
    forRent: (what: string) => `${what} for rent`,
    monthlyRent: "Monthly rent",
    /* "Administración" is a real line item on a Colombian lease: the building's monthly fee. */
    noAdminFee: "No building fee",
    adminIncluded: "Building fee included",
    minimumTermLabel: "Minimum term",
    location: "Location",
    needAccount: "You need an account to apply. It is free and takes a minute.",
    applyingCommitsNothing:
      "Applying commits you to nothing: the landlord decides, and so do you.",

    unavailableTitle: "Property not available",
    ogFallbackAlt: "Property for rent on miarriendoDIRECTO.com",

    bedroomsFact: (count: number) =>
      count === 0 ? "no separate bedroom" : count === 1 ? "1 bedroom" : `${count} bedrooms`,
    bathroomsFact: (count: number) => (count === 1 ? "1 bathroom" : `${count} bathrooms`),
    seoTitle: (what: string, where: string, price: string | null) =>
      price ? `${what} for rent in ${where} · ${price}` : `${what} for rent in ${where}`,
    seoDescription: (what: string, where: string, price: string, facts: string) =>
      `${what} for rent in ${where} for ${price} a month. ${facts}. ` +
      "Straight from the landlord, with no agency commission.",
    imageAlt: (what: string, where: string) => `${what} for rent in ${where}`,
  },

  /** Plain strings only — see the note on the Spanish side. This namespace crosses to a client. */
  poster: {
    headline: "FOR RENT",
    perMonth: "per month",
    scanPrompt: "Scan the code to see photos, the price and apply",
    linkPrompt: "See it and apply at",
    brandPrefix: "miarriendo",
    brandSuffix: "DIRECTO.com",

    title: "Rental notice",
    meta: "Generate this listing's notice to print or to share.",
    lead:
      "The QR code goes straight to the listing: whoever scans it sees the photos, the price and can apply. " +
      "The notice carries neither the address nor your phone number.",
    backToProperties: "My properties",

    wallName: "For the wall",
    wallHint: "A4 portrait. Print it and put it up at the entrance or in a window.",
    socialName: "For social",
    socialHint:
      "Square, with no QR code: nobody scans one from the same phone they are looking at it on. " +
      "What leads to the listing is the text you post with the image.",

    previewAlt: "Preview of the notice",
    loadingPreview: "Preparing the notice…",
    preparingPrint: "Preparing…",
    previewFailed: "We could not generate the notice. Reload the page and try again.",

    print: "Print",
    download: "Download",
    share: "Share",
    sharing: "Opening…",
    downloadFailed: "We could not prepare the file. Try again.",
    shareTitle: "Rental notice",

    copyText: "Copy the text",
    textCopied: "Text copied",
    copyTextFailed: "We could not copy the text. Select it and copy it by hand.",
    captionLabel: "Text to post with the image",
    captionHint:
      "It travels with the image when you share. On Instagram and Facebook you paste it into the " +
      "caption yourself: that is where the link becomes tappable.",

    blockedDraftTitle: "Publish the listing first",
    blockedDraft:
      "This listing is still a draft, so its link only works for you: the code on a notice printed now would lead to a page nobody else can open.",
    blockedUnavailableTitle: "This listing is no longer available",
    blockedUnavailable:
      "Only available listings have a public page, and the code on a notice has to lead somewhere.",
    goToProperties: "Back to my properties",
  },

  catalog: {
    titleDefault: "Find your next home",
    titleInCity: (city: string) => `Rentals in ${city}`,
    body: "Straight from the landlord, for 6 or 12 months. No middlemen and no agency commission.",
    loading: "Loading properties…",
    filtersAriaLabel: "Filters",
    paginationAriaLabel: "Pagination",
    previous: "Previous",
    next: "Next",
    pageOf: (page: number, pages: number) => `Page ${page} of ${pages}`,
    emptyFiltered:
      "No property matches what you are looking for. Try removing a filter: yours might be one block away.",
    emptyCatalog: "No properties listed yet. Come back soon — landlords are arriving.",
    clearFilters: "Clear filters",
  },
};
