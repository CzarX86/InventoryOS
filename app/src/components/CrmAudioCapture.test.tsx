import { fireEvent, render, screen } from "@testing-library/react";
import CrmAudioCapture from "./CrmAudioCapture";

describe("CrmAudioCapture", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:crm-audio") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
  });

  it("accepts an audio file and exposes a ready state", () => {
    const onAudioReady = jest.fn();
    render(<CrmAudioCapture onAudioReady={onAudioReady} />);

    const file = new File([new Uint8Array([1, 2, 3])], "reuniao.mp3", { type: "audio/mpeg" });
    fireEvent.change(screen.getByLabelText("Escolher arquivo de áudio"), { target: { files: [file] } });

    expect(onAudioReady).toHaveBeenCalledWith(expect.objectContaining({ name: "reuniao.mp3", mimeType: "audio/mpeg" }));
    expect(screen.getByRole("status")).toHaveTextContent("Áudio pronto para transcrever e registrar");
  });

  it("rejects a non-audio file without replacing the current attachment", () => {
    const onAudioReady = jest.fn();
    const onError = jest.fn();
    render(<CrmAudioCapture onAudioReady={onAudioReady} onError={onError} />);

    const file = new File([new Uint8Array([1, 2, 3])], "imagem.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Escolher arquivo de áudio"), { target: { files: [file] } });

    expect(onAudioReady).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("O arquivo escolhido precisa ser um áudio.");
    expect(screen.getByRole("alert")).toHaveTextContent("precisa ser um áudio");
  });
});
