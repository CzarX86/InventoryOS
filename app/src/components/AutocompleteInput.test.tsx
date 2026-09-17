import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import AutocompleteInput from "./AutocompleteInput";

describe("AutocompleteInput", () => {
  it("filters suggestions and selects one with the keyboard", async () => {
    const user = userEvent.setup();
    const onValueChange = jest.fn();
    const onOptionSelect = jest.fn();

    render(
      <AutocompleteInput
        id="companyName"
        value=""
        onValueChange={onValueChange}
        onOptionSelect={onOptionSelect}
        options={[
          { value: "Metalúrgica XPTO", description: "São Paulo" },
          { value: "Oficina Central", description: "Curitiba" },
        ]}
        placeholder="Nome da empresa"
      />,
    );

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.keyboard("met");

    expect(screen.getByRole("option", { name: /Metalúrgica XPTO/ })).toBeInTheDocument();
    await user.keyboard("{Enter}");

    expect(onOptionSelect).toHaveBeenCalledWith(expect.objectContaining({ value: "Metalúrgica XPTO" }));
  });

  it("keeps free text available when there is no suggestion", async () => {
    const user = userEvent.setup();

    function ControlledInput() {
      const [value, setValue] = useState("");
      return <AutocompleteInput id="companyName" value={value} onValueChange={setValue} options={[]} />;
    }

    render(<ControlledInput />);
    await user.type(screen.getByRole("combobox"), "Nova empresa");

    expect(screen.getByRole("combobox")).toHaveValue("Nova empresa");
  });
});
