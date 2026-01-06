import { fetch } from "undici";
import { CONFIG } from "./config.js";

export interface PlaceOption {
  key: string;
  label: string;
}

interface SitecoreChild {
  name?: string;
  fields?: Array<{ name: string; value?: string }>;
  children?: Array<SitecoreChild>;
}

interface SitecoreItem {
  name?: string;
  children?: Array<SitecoreChild>;
}

function getFieldValue(fields: Array<{ name: string; value?: string }> | undefined, name: string): string | undefined {
  if (!fields) return undefined;
  const match = fields.find((f) => f.name === name);
  return match?.value;
}

export async function fetchPlaceOptions(language = CONFIG.sitecoreLang): Promise<PlaceOption[]> {
  const query = `query fetchItem($path: String, $language: String) {
    item(path: $path, language: $language) {
      children {
        name
        children {
          name
          fields { name value }
        }
      }
    }
  }`;

  const res = await fetch(`${CONFIG.sitecoreGraphqlEndpoint}?sc_apikey=${encodeURIComponent(CONFIG.sitecoreApiKey)}&sc_lang=${encodeURIComponent(language)}`, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      variables: { path: CONFIG.sendungsumleitungenPath, language }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sitecore request failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { data?: { item?: SitecoreItem } };
  const item = json.data?.item;
  if (!item) {
    return [];
  }

  const ablageorte = item.children?.find((child) => child.name === "Ablageorte");
  if (!ablageorte?.children) {
    return [];
  }

  const options: PlaceOption[] = [];
  for (const child of ablageorte.children) {
    const label = getFieldValue(child.fields, "AblageortName");
    const key = getFieldValue(child.fields, "Key");
    if (label && key) {
      options.push({ key, label });
    }
  }

  return options;
}
