import { render, screen } from "@testing-library/react";
import ItemDetailModal from "./ItemDetailModal";

const enrichedItem = {
  id: "item-1234567890",
  model: "6710B",
  brand: "HP",
  type: "Laptop",
  partNumber: "RJ459AV",
  gtin: "0882780751682",
  status: "IN STOCK",
  specifications: "NOTEBOOK CORPORATIVO",
  catalogProductName: "Compaq 6710b Base Model Notebook PC",
  catalogDescription: "Notebook de teste para inventario",
  catalogProductUrl: "https://example.test/product",
  catalogDatasheetUrl: "https://example.test/datasheet.pdf",
  catalogManualUrl: "https://example.test/manual.pdf",
  metadata: {
    catalogEnrichment: {
      provider: "open_icecat",
      status: "enriched",
      matchedBy: "gtin",
      confidence: 1,
      productId: "1198270",
      reason: null,
      sourceUrl: "https://example.test/icecat",
    },
  },
};

describe("ItemDetailModal catalog enrichment", () => {
  it("shows catalog name, description, links, confidence, product id and source", () => {
    render(
      <ItemDetailModal
        isOpen
        onClose={() => {}}
        item={enrichedItem}
        onEdit={() => {}}
      />
    );

    expect(screen.getByText("CATALOG_ENRICHMENT.DB")).toBeInTheDocument();
    expect(
      screen.getByText("Compaq 6710b Base Model Notebook PC")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Notebook de teste para inventario")
    ).toBeInTheDocument();
    expect(screen.getByText("CONFIDENCE: 100%")).toBeInTheDocument();
    expect(screen.getByText("1198270")).toBeInTheDocument();
    expect(screen.getByText("CATALOG_PRODUCT_URL")).toHaveAttribute(
      "href",
      "https://example.test/product"
    );
    expect(screen.getByText("CATALOG_DATASHEET_URL")).toHaveAttribute(
      "href",
      "https://example.test/datasheet.pdf"
    );
    expect(screen.getByText("CATALOG_MANUAL_URL")).toHaveAttribute(
      "href",
      "https://example.test/manual.pdf"
    );
    expect(screen.getByText("OPEN_ICECAT_SOURCE")).toHaveAttribute(
      "href",
      "https://example.test/icecat"
    );
  });

  it("shows the enrichment reason when lookup did not enrich", () => {
    render(
      <ItemDetailModal
        isOpen
        onClose={() => {}}
        item={{
          ...enrichedItem,
          catalogProductName: null,
          catalogDescription: null,
          catalogProductUrl: null,
          catalogDatasheetUrl: null,
          catalogManualUrl: null,
          metadata: {
            catalogEnrichment: {
              provider: "open_icecat",
              status: "not_found",
              matchedBy: null,
              confidence: null,
              productId: null,
              reason: "product_not_found_in_open_icecat",
              sourceUrl: null,
            },
          },
        }}
        onEdit={() => {}}
      />
    );

    expect(screen.getByText("CATALOG_ENRICHMENT.DB")).toBeInTheDocument();
    expect(screen.getByText("not_found")).toBeInTheDocument();
    expect(
      screen.getByText("product_not_found_in_open_icecat")
    ).toBeInTheDocument();
  });

  it("hides the enrichment section when there is no enrichment data", () => {
    render(
      <ItemDetailModal
        isOpen
        onClose={() => {}}
        item={{ id: "item-plain-1", model: "CFW500", brand: "WEG" }}
        onEdit={() => {}}
      />
    );

    expect(
      screen.queryByText("CATALOG_ENRICHMENT.DB")
    ).not.toBeInTheDocument();
  });
});

describe("ItemDetailModal pricing", () => {
  const pricedItem = {
    id: "item-priced-1",
    model: "CFW500",
    brand: "WEG",
    status: "IN STOCK",
    salePrice: 1800,
    priceSource: "MERCADO LIVRE",
    priceReferences: [
      { url: "https://example.test/a", price: 1000, label: "Anúncio A" },
      { url: "https://example.test/b", price: 2000, label: "Anúncio B" },
    ],
  };

  it("shows sale price, reference average and links", () => {
    render(
      <ItemDetailModal
        isOpen
        onClose={() => {}}
        item={pricedItem}
        onEdit={() => {}}
      />
    );

    expect(screen.getByText("PREÇO_MÉDIO_VENDA.DB")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.800,00")).toBeInTheDocument();
    expect(screen.getByText("MÉDIA_REFERÊNCIAS (2)")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.500,00")).toBeInTheDocument();
    expect(screen.getByText("Anúncio A")).toHaveAttribute(
      "href",
      "https://example.test/a"
    );
    expect(screen.getByText("Anúncio B")).toHaveAttribute(
      "href",
      "https://example.test/b"
    );
  });

  it("hides the pricing section when there is no price data", () => {
    render(
      <ItemDetailModal
        isOpen
        onClose={() => {}}
        item={{ id: "item-plain-2", model: "CFW500", brand: "WEG" }}
        onEdit={() => {}}
      />
    );

    expect(
      screen.queryByText("PREÇO_MÉDIO_VENDA.DB")
    ).not.toBeInTheDocument();
  });
});
