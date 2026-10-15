/** Minimal VC shape used by the sandbox (VCDM 2.x-ish). */
export type VerifiableCredential = {
  "@context"?: unknown;
  type?: string | string[];
  issuer?: string | { id?: string; name?: string; [key: string]: unknown };
  credentialSubject?: Record<string, unknown> | Record<string, unknown>[];
  renderMethod?: RenderMethod | RenderMethod[];
  [key: string]: unknown;
};

/**
 * W3C VC Render Method — SuiteRenderMethod entry.
 * @see https://www.w3.org/TR/vc-render-method/#the-rendermethod-property
 */
export type RenderMethod = {
  type: "SuiteRenderMethod" | string;
  renderSuite?: "html" | "summary" | "static" | string;
  id?: string;
  name?: string;
  description?: string;
  /** JSON Pointer paths; absent ⇒ entire VC is shared with the template. */
  renderProperty?: string[];
  template?: string | TemplateReference;
  digestMultibase?: string;
  mediaType?: string;
  outputPreference?: OutputPreference;
  [key: string]: unknown;
};

export type TemplateReference = {
  id: string;
  mediaType?: string;
  digestMultibase?: string;
};

export type OutputPreference = {
  accessMode?: Array<"auditory" | "tactile" | "textual" | "visual" | string>;
  mediaType?: string;
  style?: {
    width?: string;
    height?: string;
    [key: string]: unknown;
  };
};

export type HtmlRenderResult = {
  ready: Promise<void>;
  iframe: HTMLIFrameElement;
  filteredCredential: VerifiableCredential;
  templateSource: string;
  /** Close the MessageChannel when tearing down the mount. */
  dispose: () => void;
};
