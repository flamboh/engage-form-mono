import {
  budgetLineText,
  generateBusinessPurpose,
  recipientIdText,
  recipientValueText,
  reimbursementRecipientText,
  type Purchase,
} from "@engage-form/domain";

export type EngageStep =
  | "about"
  | "claims"
  | "purchaseType"
  | "reimbursement"
  | "selfApproval"
  | "documentation"
  | "publicity"
  | "gifts"
  | "thankYou"
  | "review"
  | "unknown";

export type FillAction =
  | { type: "text"; labelIncludes: string; value: string }
  | { type: "textarea"; labelIncludes: string; value: string }
  | { type: "checkbox"; labelIncludes: string; checked: boolean }
  | { type: "radio"; labelIncludes: string }
  | { type: "select"; labelIncludes: string; valueIncludes: string }
  | { type: "stop"; message: string };

export type FillPlan = {
  step: EngageStep;
  actions: FillAction[];
};

export function detectStep(headingText: string): EngageStep {
  const text = normalize(headingText);

  if (text.includes("about you, your org, and business purpose")) return "about";
  if (text.includes("mandatory claims")) return "claims";
  if (text.includes("type of purchase")) return "purchaseType";
  if (text.includes("personal reimbursement purchase info")) return "reimbursement";
  if (text.includes("seeking self reimbursement")) return "selfApproval";
  if (text.includes("documentation inquiry")) return "documentation";
  if (text.includes("event open to all students")) return "publicity";
  if (text.includes("uo branding/apparel/gifts")) return "gifts";
  if (text.includes("thank you")) return "thankYou";
  if (text.includes("review submission")) return "review";

  return "unknown";
}

export function createFillPlan(step: EngageStep, purchase: Purchase): FillPlan {
  switch (step) {
    case "about":
      return {
        step,
        actions: [
          text("Requestor's first and last name", purchase.purchaser.name),
          text("Requestor's email address", purchase.purchaser.email),
          text("Requestor's phone number", purchase.purchaser.phone),
          text("Name of Student Organization", purchase.organization.name),
          text("Student Organization Index", purchase.organization.indexNumber),
          checkbox(purchase.organization.fundLetter, true),
          text("total amount", formatFormMoney(purchase.totalAmount)),
          text("Line Item", budgetLineText(purchase)),
          textarea("business purpose", generateBusinessPurpose(purchase)),
        ],
      };
    case "claims":
      return {
        step,
        actions: [
          checkbox("no alcohol", true),
          checkbox("not host a raffle", true),
          checkbox("ASUO rule", true),
          checkbox("personal reimbursements", true),
        ],
      };
    case "purchaseType":
      return { step, actions: [radio("Personal Reimbursement")] };
    case "reimbursement":
      return {
        step,
        actions: [
          text("Why did you use the reimbursement process", purchase.reimbursementReason),
          select("submitter of this form", "Myself"),
          text("name and UO 95 ID", reimbursementRecipientText(purchase)),
          text("permanent address", purchase.purchaser.permanentAddress),
          checkbox("mailing address", true),
        ],
      };
    case "selfApproval":
      return {
        step,
        actions: [stop("Upload the second authorized signer approval, then continue.")],
      };
    case "documentation":
      return {
        step,
        actions: [
          checkbox("ASUO funds", true),
          checkbox("food", false),
          checkbox("printing services", false),
          checkbox("merchandise/apparel or gifts", true),
          checkbox("office supplies/goods", false),
          checkbox("None of the above", false),
        ],
      };
    case "publicity":
      return { step, actions: [stop("Upload publicity proof, then continue.")] };
    case "gifts":
      return {
        step,
        actions: [
          textarea("per person gift/apparel/prize amount", recipientValueText(purchase)),
          textarea("name and 95# of the recipient", recipientIdText(purchase)),
        ],
      };
    case "thankYou":
      return { step, actions: [stop("Continue to review when ready.")] };
    case "review":
      return { step, actions: [stop("Review reached. Submit manually in Engage.")] };
    case "unknown":
      return { step, actions: [stop("Unknown Engage step. No fields filled.")] };
  }
}

export function stepLabel(step: EngageStep) {
  switch (step) {
    case "about":
      return "About/org/purpose";
    case "claims":
      return "Mandatory claims";
    case "purchaseType":
      return "Type of purchase";
    case "reimbursement":
      return "Reimbursement info";
    case "selfApproval":
      return "Self approval";
    case "documentation":
      return "Documentation inquiry";
    case "publicity":
      return "Event publicity";
    case "gifts":
      return "Gifts/apparel";
    case "thankYou":
      return "Thank you";
    case "review":
      return "Review";
    case "unknown":
      return "Unknown";
  }
}

function text(labelIncludes: string, value: string): FillAction {
  return { type: "text", labelIncludes, value };
}

function textarea(labelIncludes: string, value: string): FillAction {
  return { type: "textarea", labelIncludes, value };
}

function checkbox(labelIncludes: string, checked: boolean): FillAction {
  return { type: "checkbox", labelIncludes, checked };
}

function radio(labelIncludes: string): FillAction {
  return { type: "radio", labelIncludes };
}

function select(labelIncludes: string, valueIncludes: string): FillAction {
  return { type: "select", labelIncludes, valueIncludes };
}

function stop(message: string): FillAction {
  return { type: "stop", message };
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatFormMoney(amount: number) {
  return `$${amount.toFixed(2)}`;
}
