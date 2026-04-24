import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  generateBusinessPurpose,
  samplePurchase,
  validatePurchaseReadiness,
  type Purchase,
} from "@engage-form/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/app")({
  component: PurchaseBuilderPage,
});

function PurchaseBuilderPage() {
  const [purchase, setPurchase] = useState<Purchase>(() => structuredClone(samplePurchase));
  const issues = validatePurchaseReadiness(purchase);
  const purpose = generateBusinessPurpose(purchase);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 md:py-10">
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="flex flex-col gap-3">
          <Badge variant="outline" className="self-start">
            Engage Form
          </Badge>
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-4xl leading-none font-semibold tracking-tight md:text-5xl">
              Purchase builder
            </h1>
            <p className="text-muted-foreground">
              Personal reimbursement, ASUO funds, prize/gift path.
            </p>
          </div>
        </div>
        <Card size="sm" className="w-full md:w-48">
          <CardHeader>
            <CardDescription>{issues.length === 0 ? "Ready" : "Draft"}</CardDescription>
            <CardTitle>
              {issues.length === 0 ? "Can fill Engage" : `${issues.length} missing`}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Purchase</CardTitle>
            <CardDescription>
              {purchase.organization.name} / {purchase.organization.indexNumber}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <TextInput
              label="Vendor"
              value={purchase.vendor}
              onChange={(value) => setPurchaseField(setPurchase, "vendor", value)}
            />
            <TextInput
              label="Item"
              value={purchase.itemDescription}
              onChange={(value) => setPurchaseField(setPurchase, "itemDescription", value)}
            />
            <TextInput
              label="Amount"
              type="number"
              step="0.01"
              value={purchase.totalAmount.toFixed(2)}
              onChange={(value) => setPurchaseNumber(setPurchase, "totalAmount", value)}
            />
            <TextInput
              label="Event date"
              value={purchase.eventDate}
              onChange={(value) => setPurchaseField(setPurchase, "eventDate", value)}
            />
            <TextInput
              label="Reimbursement reason"
              value={purchase.reimbursementReason}
              onChange={(value) => setPurchaseField(setPurchase, "reimbursementReason", value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recipient</CardTitle>
            <CardDescription>Gift/prize limit checked before ready.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <TextInput
              label="Name"
              value={purchase.recipients[0].name}
              onChange={(value) => setRecipientField(setPurchase, "name", value)}
            />
            <TextInput
              label="UO 95"
              value={purchase.recipients[0].uo95}
              onChange={(value) => setRecipientField(setPurchase, "uo95", value)}
            />
            <TextInput
              label="Reason"
              value={purchase.recipients[0].reason}
              onChange={(value) => setRecipientField(setPurchase, "reason", value)}
            />
            <TextInput
              label="Gift value"
              type="number"
              step="0.01"
              value={purchase.recipients[0].value.toFixed(2)}
              onChange={(value) => setRecipientNumber(setPurchase, value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Event preset</CardTitle>
            <CardDescription>{purchase.eventPreset.scheduleLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              <Fact label="Name" value={purchase.eventPreset.name} />
              <Fact label="Time" value={purchase.eventPreset.time} />
              <Fact label="Location" value={purchase.eventPreset.location} />
              <Fact label="Attendance" value={String(purchase.eventPreset.estimatedAttendance)} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
            <CardDescription>Metadata only in this local MVP.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {purchase.files.map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-4 text-sm">
                  <Badge variant="secondary">{file.kind}</Badge>
                  <span className="truncate text-right">{file.filename}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Business purpose</CardTitle>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(purpose)}
            >
              Copy
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="max-w-4xl text-sm leading-6 text-muted-foreground">{purpose}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Readiness</CardTitle>
          <CardDescription>
            {issues.length === 0 ? "All required fields present." : "Fix these before Engage."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3">
            {issues.length === 0 ? (
              <li className="text-sm text-muted-foreground">
                Ready purchase available for the extension.
              </li>
            ) : (
              issues.map((issue) => (
                <li key={`${issue.field}:${issue.message}`} className="text-sm text-destructive">
                  {issue.message}
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between gap-4 text-sm">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="text-right">{value}</dd>
      </div>
      <Separator />
    </div>
  );
}

type TextInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  step?: string;
};

function TextInput({ label, value, onChange, type = "text", step }: TextInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId(label)}>{label}</Label>
      <Input
        id={fieldId(label)}
        type={type}
        step={step}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
}

function fieldId(label: string) {
  return `purchase-${label.toLowerCase().replaceAll(" ", "-")}`;
}

function setPurchaseField(
  setPurchase: (update: (purchase: Purchase) => Purchase) => void,
  field: StringPurchaseField,
  value: string,
) {
  setPurchase((purchase) => ({ ...purchase, [field]: value }));
}

function setPurchaseNumber(
  setPurchase: (update: (purchase: Purchase) => Purchase) => void,
  field: NumberPurchaseField,
  value: string,
) {
  setPurchase((purchase) => ({ ...purchase, [field]: Number(value) }));
}

function setRecipientField(
  setPurchase: (update: (purchase: Purchase) => Purchase) => void,
  field: StringRecipientField,
  value: string,
) {
  setPurchase((purchase) => ({
    ...purchase,
    recipients: [{ ...purchase.recipients[0], [field]: value }],
  }));
}

function setRecipientNumber(
  setPurchase: (update: (purchase: Purchase) => Purchase) => void,
  value: string,
) {
  setPurchase((purchase) => ({
    ...purchase,
    recipients: [{ ...purchase.recipients[0], value: Number(value) }],
  }));
}

type StringPurchaseField = "vendor" | "itemDescription" | "eventDate" | "reimbursementReason";
type NumberPurchaseField = "totalAmount";
type StringRecipientField = "name" | "uo95" | "reason";
