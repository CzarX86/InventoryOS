import { Input } from "@/components/ui/input";

const PHONE_LABEL_OPTIONS = ["Celular", "Comercial", "Residencial", "WhatsApp"];
const EMAIL_LABEL_OPTIONS = ["Principal", "Comercial", "Financeiro", "Pessoal"];

export function CrmContactChannelLabelControl({
  kind,
  index,
  label,
  onChange,
}: {
  kind: "phone" | "email";
  index: number;
  label: string;
  onChange: (value: string) => void;
}) {
  const fieldName = kind === "phone" ? "telefone" : "e-mail";
  const listId = `crm-${kind}-label-options-${index}`;
  const options = kind === "phone" ? PHONE_LABEL_OPTIONS : EMAIL_LABEL_OPTIONS;

  return <>
    <Input
      aria-label={`Rótulo do ${fieldName} ${index + 1}`}
      list={listId}
      value={label}
      onChange={(event) => onChange(event.target.value)}
      className="h-10"
      placeholder="Escolha ou digite um rótulo"
      autoComplete="off"
    />
    <datalist id={listId}>
      {options.map((option) => <option key={option} value={option} />)}
    </datalist>
  </>;
}
