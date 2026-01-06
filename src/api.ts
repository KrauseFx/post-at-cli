import { fetch } from "undici";
import { CONFIG } from "./config.js";

export type SortDirection = "ASCENDING" | "DESCENDING";
export type PagingMode = "RECEIVE" | "SEND" | "RECEIVE_AND_SEND";

export interface SendungSummary {
  sendungsnummer: string;
  sender?: string;
  status?: string;
  bezeichnung?: string;
  estimatedDelivery?: {
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
  };
  hasNewFlag?: boolean;
}

export interface SendungDetail extends SendungSummary {
  bild?: unknown;
  preshipper?: string;
  weight?: number;
  sendungsEvents?: Array<{
    timestamp?: string;
    status?: string;
    reasontypecode?: string;
    text?: string;
    textEn?: string;
    eventpostalcode?: string;
    eventcountry?: string;
  }>;
}

function buildSendungenQuery(
  elementCount: number,
  sortByDate: SortDirection,
  paging: PagingMode
): string {
  return `query {
    pagedSendungen: sendungen(postProcessingOptions: { elementCount: ${elementCount} sortByDate: ${sortByDate} paging: ${paging} }) {
      totalSendungen
      versandSendungen
      empfangsSendungen
      sendungen {
        sendungsnummer
        isRecipient
        hasNewFlag
        tags {
          key
          textDe
        }
        estimatedDelivery {
          startDate
          endDate
          startTime
          endTime
        }
        possibleRedirectionsNoDepositories {
          abholstation
          abstellort
          datum
          filliale
          nachbar
          zustelldatum
          branchesParcelLocker
          branchesPostOffice
          redirectionAreaCode
        }
        packageRedirections {
          customdeliveryday {
            customDeliveryDates
            estimatedDelivery
            selectedCustomDeliveryDay
            isSelected
          }
          neighbor {
            firstname
            lastname
            street
            streetNr
            isSelected
          }
          parcellocker {
            isSelected
            selectedBranch
            selectedRedirectionAreaCode
          }
          place {
            beschreibung
            isSelected
          }
          postoffice {
            isSelected
            selectedBranch
            selectedRedirectionAreaCode
          }
        }
        sendungsEvents {
          timestamp
          reasontypecode
          eventcountry
          eventpostalcode
        }
        schadensmeldungValide
        sender
        status
        bezeichnung
        recipientAddress {
          consigneeName
          consigneeAdditionalStreet
          consigneeCity
          consigneeCountry
          consigneePostalCode
          consigneeRegion
          consigneeStreet
          consigneeStreetNr
        }
        customsInformation {
          customsDocumentAvailable
          userDocumentNeeded
        }
        orderId
        parcelStampId
        parcelStampValidTo
        hasPayment
        ssoidmatch
        paymentInformation {
          ssoSignInNecessary
          payableAmounts {
            amount
            amountPaid
            dueDate
            type
          }
        }
      }
    }
  }`;
}

function buildSendungDetailQuery(sendungsnummer: string): string {
  return `query {
    einzelsendung(sendungsnummer: "${sendungsnummer}") {
      sendungsnummer
      externalIdentityCode
      branchkey
      estimatedDelivery {
        startDate
        endDate
        startTime
        endTime
      }
      dimensions {
        height
        width
        length
      }
      isMeineSendung
      isRecipient
      schadensmeldungValide
      recipientAddress {
        consigneeAdditionalStreet
        consigneeCity
        consigneeCountry
        consigneeName
        consigneePostalCode
        consigneeRegion
        consigneeStreet
        consigneeStreetNr
      }
      possibleRedirectionsNoDepositories {
        abholstation
        abstellort
        datum
        filliale
        nachbar
        zustelldatum
        branchesParcelLocker
        branchesPostOffice
        redirectionAreaCode
      }
      packageRedirections {
        customdeliveryday {
          customDeliveryDates
          estimatedDelivery
          selectedCustomDeliveryDay
          isSelected
        }
        neighbor {
          firstname
          lastname
          street
          streetNr
          isSelected
        }
        parcellocker {
          isSelected
          selectedBranch
          selectedRedirectionAreaCode
        }
        place {
          beschreibung
          isSelected
        }
        postoffice {
          isSelected
          selectedBranch
          selectedRedirectionAreaCode
        }
      }
      sender
      preshipper
      features
      status
      weight
      bild
      sendungsEvents {
        timestamp
        status
        reasontypecode
        text
        textEn
        eventpostalcode
        eventcountry
      }
      bezeichnung
      recipient {
        name
        postCode
      }
      orderId
      parcelStampId
      parcelStampValidTo
      hasPayment
    }
  }`;
}

async function graphqlRequest<T>(token: string, query: string): Promise<T> {
  const res = await fetch(CONFIG.graphqlAuthenticated, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ query })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GraphQL request failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  if (!json.data) {
    throw new Error("GraphQL response missing data.");
  }
  return json.data;
}

export async function fetchSendungen(
  token: string,
  elementCount = 50,
  sortByDate: SortDirection = "DESCENDING",
  paging: PagingMode = "RECEIVE_AND_SEND"
): Promise<SendungSummary[]> {
  const query = buildSendungenQuery(elementCount, sortByDate, paging);
  const data = await graphqlRequest<{ pagedSendungen: { sendungen: SendungSummary[] } }>(
    token,
    query
  );
  return data.pagedSendungen.sendungen;
}

export async function fetchSendungDetail(
  token: string,
  sendungsnummer: string
): Promise<SendungDetail> {
  const query = buildSendungDetailQuery(sendungsnummer);
  const data = await graphqlRequest<{ einzelsendung: SendungDetail }>(token, query);
  return data.einzelsendung;
}
