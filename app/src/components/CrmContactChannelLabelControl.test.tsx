import { fireEvent, render, screen } from "@testing-library/react";
import { CrmContactChannelLabelControl } from "./CrmContactChannelLabelControl";

describe("CrmContactChannelLabelControl", () => {
  it("offers preset suggestions through the same free-text input", () => {
    const onChange = jest.fn();
    const { container } = render(
      <CrmContactChannelLabelControl kind="phone" index={0} label="Diretoria" onChange={onChange} />,
    );

    const input = screen.getByLabelText("Rótulo do telefone 1");
    expect(input).toHaveValue("Diretoria");
    expect(container.querySelectorAll("input")).toHaveLength(1);
    expect(input).toHaveAttribute("list", "crm-phone-label-options-0");
    expect(container.querySelector('datalist option[value="Celular"]')).toBeInTheDocument();
    expect(container.querySelector('datalist option[value="WhatsApp"]')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Diretoria regional" } });
    expect(onChange).toHaveBeenCalledWith("Diretoria regional");
  });

  it("provides email-specific suggestions without restricting custom labels", () => {
    const onChange = jest.fn();
    const { container } = render(
      <CrmContactChannelLabelControl kind="email" index={1} label="Fiscal" onChange={onChange} />,
    );

    expect(screen.getByLabelText("Rótulo do e-mail 2")).toHaveValue("Fiscal");
    expect(container.querySelector('datalist option[value="Financeiro"]')).toBeInTheDocument();
  });
});
