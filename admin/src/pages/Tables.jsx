import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styled, { css, keyframes } from "styled-components";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../services/supabase";
import { useRestaurant } from "../context/RestaurantContext";
import { useLanguage } from "../context/LanguageContext";
import { TopBarSlotsContext } from "../components/Layout";
import { cardPanel } from "../styles/cards";
import { getCustomerAppBaseUrl, getCustomerDevPort } from "../utils/customerAppUrl";

function useLocalNetworkBaseUrl() {
  const [networkBaseUrl, setNetworkBaseUrl] = useState(null);
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  useEffect(() => {
    if (!isLocalhost) return;
    let cancelled = false;
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel("");
    pc.createOffer().then((offer) => pc.setLocalDescription(offer));
    pc.onicecandidate = (e) => {
      if (cancelled || !e.candidate) return;
      const match = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(e.candidate.candidate);
      if (match) {
        const ip = match[1];
        if (!ip.startsWith("127.")) {
          const port = getCustomerDevPort();
          setNetworkBaseUrl(`http://${ip}:${port}`);
          pc.close();
        }
      }
    };
    const t = setTimeout(() => {
      pc.close();
    }, 5000);
    return () => {
      cancelled = true;
      clearTimeout(t);
      pc.close();
    };
  }, [isLocalhost]);

  return networkBaseUrl;
}

const Tables = () => {
  const { restaurant } = useRestaurant();
  const { t } = useLanguage();
  const { actionsEl: topBarActionsEl } = useContext(TopBarSlotsContext);
  const [tables, setTables] = useState([]);
  const [tableNumber, setTableNumber] = useState("");
  const [tableName, setTableName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTableId, setEditingTableId] = useState(null);
  const [copiedTableId, setCopiedTableId] = useState(null);
  const [tablePendingDelete, setTablePendingDelete] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const networkBaseUrl = useLocalNetworkBaseUrl();

  const loadTables = async () => {
    if (!restaurant?.id) return;
    const { data } = await supabase
      .from("tables")
      .select("id, table_number, table_name")
      .eq("restaurant_id", restaurant.id)
      .order("table_number", { ascending: true });
    setTables(data ?? []);
  };

  useEffect(() => {
    loadTables();
  }, [restaurant]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!restaurant?.id) return;
    const nextNumber = Number(tableNumber);
    if (Number.isNaN(nextNumber)) return;

    setLoading(true);
    if (editingTableId) {
      await supabase
        .from("tables")
        .update({
          table_number: nextNumber,
          table_name: tableName.trim() || null
        })
        .eq("id", editingTableId);
    } else {
      await supabase.from("tables").insert({
        restaurant_id: restaurant.id,
        table_number: nextNumber,
        table_name: tableName.trim() || null
      });
    }
    setLoading(false);
    closeForm();
    loadTables();
  };

  const openAddForm = () => {
    setEditingTableId(null);
    setTableNumber("");
    setTableName("");
    setIsFormOpen(true);
  };

  const openEditForm = (table) => {
    setEditingTableId(table.id);
    setTableNumber(table.table_number != null ? String(table.table_number) : "");
    setTableName(table.table_name ?? "");
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingTableId(null);
    setTableNumber("");
    setTableName("");
  };

  const closeDeleteConfirm = () => {
    if (deleting) return;
    setTablePendingDelete(null);
  };

  const confirmDeleteTable = async () => {
    if (!tablePendingDelete || !restaurant?.id) return;
    const table = tablePendingDelete;
    setDeleting(true);
    setRemovingId(table.id);
    setErrorMessage("");

    const { error: unlinkError } = await supabase
      .from("orders")
      .update({ table_id: null })
      .eq("table_id", table.id);

    if (unlinkError) {
      setDeleting(false);
      setRemovingId(null);
      setErrorMessage(unlinkError.message || t("couldNotDeleteTable"));
      return;
    }

    const { data, error } = await supabase
      .from("tables")
      .delete()
      .eq("id", table.id)
      .eq("restaurant_id", restaurant.id)
      .select("id");

    if (error || !data?.length) {
      setDeleting(false);
      setRemovingId(null);
      setErrorMessage(error?.message || t("couldNotDeleteTable"));
      return;
    }

    setTablePendingDelete(null);
    await new Promise((resolve) => window.setTimeout(resolve, 320));
    setTables((prev) => prev.filter((item) => item.id !== table.id));
    setDeleting(false);
    setRemovingId(null);
  };

  const baseUrl = getCustomerAppBaseUrl(networkBaseUrl);

  const buildUrl = (tableId) =>
    restaurant?.id ? `${baseUrl}/r/${restaurant.id}/t/${tableId}` : "";

  const handleDownload = (tableId, tableNumber) => {
    const canvas = document.getElementById(`qr-${tableId}`);
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `table-${tableNumber}-qr.png`;
    link.click();
  };

  const handleCopyLink = async (tableId) => {
    const url = buildUrl(tableId);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedTableId(tableId);
      window.setTimeout(() => {
        setCopiedTableId((current) => (current === tableId ? null : current));
      }, 1500);
    } catch {
      // Fallback for older browsers / insecure contexts
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedTableId(tableId);
      window.setTimeout(() => {
        setCopiedTableId((current) => (current === tableId ? null : current));
      }, 1500);
    }
  };

  return (
    <Page>
      {topBarActionsEl &&
        createPortal(
          <AddTableButton type="button" onClick={openAddForm}>
            {t("addTableButton")}
          </AddTableButton>,
          topBarActionsEl
        )}

      {errorMessage ? <ErrorBanner>{errorMessage}</ErrorBanner> : null}

      {isFormOpen && (
        <ModalOverlay onClick={closeForm}>
          <ModalCard onClick={(event) => event.stopPropagation()}>
            <ModalHeader>
              <ModalHeading>
                <ModalEyebrow>{t("tables")}</ModalEyebrow>
                <ModalTitle>{editingTableId ? t("editTable") : t("addTable")}</ModalTitle>
              </ModalHeading>
              <ModalClose type="button" aria-label={t("close")} onClick={closeForm}>
                ×
              </ModalClose>
            </ModalHeader>
            <ModalForm onSubmit={handleSubmit}>
              <ModalBody>
                <ModalField>
                  <label htmlFor="table-number">{t("tableNumber")}</label>
                  <input
                    id="table-number"
                    type="number"
                    min="1"
                    value={tableNumber}
                    onChange={(event) => setTableNumber(event.target.value)}
                    placeholder={t("tableNumberPlaceholder")}
                    required
                    autoFocus
                  />
                </ModalField>
                <ModalField>
                  <label htmlFor="table-name">{t("tableName")}</label>
                  <input
                    id="table-name"
                    type="text"
                    value={tableName}
                    onChange={(event) => setTableName(event.target.value)}
                    placeholder={t("locationPlaceholder")}
                  />
                  <ModalHint>{t("tableNameHint")}</ModalHint>
                </ModalField>
              </ModalBody>
              <ModalFooter>
                <SecondaryButton type="button" onClick={closeForm}>
                  {t("cancel")}
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={loading}>
                  {loading
                    ? editingTableId
                      ? t("saving")
                      : t("adding")
                    : editingTableId
                      ? t("saveChanges")
                      : t("addTableButton")}
                </PrimaryButton>
              </ModalFooter>
            </ModalForm>
          </ModalCard>
        </ModalOverlay>
      )}

      <List>
        {tables.map((table) => (
          <Row
            key={table.id}
            $confirming={tablePendingDelete?.id === table.id}
            $leaving={removingId === table.id}
          >
            <QRCard>
              {buildUrl(table.id) ? (
                <QRCodeCanvas
                  id={`qr-${table.id}`}
                  value={buildUrl(table.id)}
                  size={120}
                  includeMargin
                />
              ) : null}
            </QRCard>
            <TableTitle>
              {table.table_name
                ? `${table.table_name} ${table.table_number}`
                : t("tableLabel", { number: table.table_number })}
            </TableTitle>
            <UrlText
              type="button"
              title={copiedTableId === table.id ? t("copied") : t("clickToCopyLink")}
              onClick={() => handleCopyLink(table.id)}
              $copied={copiedTableId === table.id}
            >
              {copiedTableId === table.id ? t("linkCopied") : buildUrl(table.id)}
            </UrlText>
            <Actions>
              {tablePendingDelete?.id === table.id ? (
                <>
                  <SecondaryButton
                    type="button"
                    onClick={closeDeleteConfirm}
                    disabled={deleting}
                  >
                    {t("cancel")}
                  </SecondaryButton>
                  <DangerButton
                    type="button"
                    onClick={confirmDeleteTable}
                    disabled={deleting}
                  >
                    {deleting ? <Spinner aria-hidden="true" /> : null}
                    {deleting ? t("deleting") : t("confirmDelete")}
                  </DangerButton>
                </>
              ) : (
                <>
              <PrimaryButton
                type="button"
                onClick={() => handleDownload(table.id, table.table_number)}
              >
                {t("downloadQr")}
              </PrimaryButton>
              <IconButton
                type="button"
                aria-label={t("editTableAria")}
                onClick={() => openEditForm(table)}
              >
                <EditIcon viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4M12 20h8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </EditIcon>
              </IconButton>
              <DangerIconButton
                type="button"
                aria-label={t("deleteTableAria")}
                onClick={() => {
                  setErrorMessage("");
                  setTablePendingDelete(table);
                }}
              >
                <TrashIcon viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0l1 11a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-11M10 11v5m4-5v5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </TrashIcon>
              </DangerIconButton>
                </>
              )}
            </Actions>
          </Row>
        ))}
      </List>
    </Page>
  );
};

const cardLeave = keyframes`
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(12px) scale(0.94);
  }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const ErrorBanner = styled.p`
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.08);
  color: #b91c1c;
  font-size: 13px;
  font-weight: 600;
`;

const DangerButton = styled.button`
  padding: 8px 14px;
  border-radius: 999px;
  border: none;
  background: #dc2626;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 1 1 auto;

  &:disabled {
    opacity: 0.7;
    cursor: default;
  }
`;

const Spinner = styled.span`
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #ffffff;
  animation: ${spin} 0.7s linear infinite;
  flex-shrink: 0;
`;

const Page = styled.div`
  display: grid;
  gap: 18px;
  align-content: start;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
`;

const AddTableButton = styled.button`
  height: 36px;
  padding: 0 16px;
  border-radius: 999px;
  border: none;
  background: var(--sidebar-orange);
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
`;

const PrimaryButton = styled.button`
  padding: 8px 14px;
  border-radius: 999px;
  border: none;
  background: var(--sidebar-orange);
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.7;
    cursor: default;
  }
`;

const List = styled.div`
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));

  @media (max-width: 600px) {
    gap: 12px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 380px) {
    gap: 10px;
  }
`;

const Row = styled.div`
  ${cardPanel}
  border-color: var(--orders-container-border);
  padding: 18px;
  display: grid;
  grid-auto-rows: min-content;
  justify-items: center;
  align-items: center;
  gap: 14px;
  position: relative;
  overflow: hidden;
  min-height: 320px;
  transform-origin: center;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  ${({ $confirming }) =>
    $confirming &&
    css`
      border-color: rgba(239, 68, 68, 0.45);
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
    `}

  ${({ $leaving }) =>
    $leaving &&
    css`
      animation: ${cardLeave} 0.32s ease forwards;
      pointer-events: none;
    `}

  @media (max-width: 600px) {
    padding: 16px;
    gap: 12px;
    min-height: 0;
  }
`;

const TableTitle = styled.span`
  font-weight: 600;
  font-size: 16px;
  text-align: center;
  z-index: 1;
  line-height: 1.3;
  color: var(--tables-text);
`;

const UrlText = styled.button`
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 12px;
  color: ${({ $copied }) => ($copied ? "var(--sidebar-orange)" : "var(--tables-text)")};
  opacity: ${({ $copied }) => ($copied ? 1 : 0.65)};
  word-break: break-all;
  text-align: center;
  z-index: 1;
  max-width: 200px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
  transition: color 0.15s ease, opacity 0.15s ease;

  &:hover {
    opacity: 1;
    color: var(--sidebar-orange);
  }

  @media (max-width: 600px) {
    max-width: 100%;
    font-size: 11px;
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  white-space: nowrap;
  justify-content: center;
  align-items: center;
  z-index: 1;
  width: 100%;

  ${PrimaryButton} {
    flex: 1 1 auto;
    min-width: 0;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  @media (max-width: 600px) {
    flex-wrap: wrap;

    ${PrimaryButton} {
      flex: 1 1 100%;
    }
  }
`;

const IconButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--orders-container-border);
  background: var(--tables-bg);
  color: var(--tables-text);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;

  &:hover {
    background: color-mix(in srgb, var(--orders-container-border) 35%, var(--surface));
    border-color: color-mix(in srgb, var(--orders-container-border) 55%, var(--text) 45%);
    transform: translateY(-1px);
  }
`;

const EditIcon = styled.svg`
  width: 16px;
  height: 16px;
  stroke: currentColor;
`;

const QRCard = styled.div`
  padding: 12px;
  display: grid;
  place-items: center;
  z-index: 1;
  border: 1px solid var(--orders-container-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface) 94%, var(--bg) 6%);
  max-width: 100%;

  canvas {
    background: #fff;
    border-radius: 12px;
    padding: 8px;
  }

  @media (max-width: 600px) {
    padding: 8px;
    width: 100%;

    canvas {
      width: 100% !important;
      height: auto !important;
      padding: 6px;
    }
  }
`;

const SecondaryButton = styled.button`
  border: 1px solid var(--orders-container-border);
  background: var(--tables-bg);
  color: var(--tables-text);
  border-radius: 999px;
  padding: 8px 12px;
  cursor: pointer;
  flex: 1 1 auto;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

const DangerIconButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(239, 68, 68, 0.5);
  background: var(--tables-bg);
  color: var(--tables-text);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.6);
    transform: translateY(-1px);
  }
`;

const TrashIcon = styled.svg`
  width: 16px;
  height: 16px;
  stroke: currentColor;
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, #0f172a 55%, transparent);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  z-index: 30;
  padding: 24px;

  @media (max-width: 600px) {
    align-items: start;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 16px;
  }
`;

const ModalCard = styled.div`
  width: min(440px, 100%);
  ${cardPanel}
  border-color: var(--orders-container-border);
  padding: 0;
  overflow: hidden;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--orders-container-border);
`;

const ModalHeading = styled.div`
  display: grid;
  gap: 4px;
`;

const ModalEyebrow = styled.span`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--sidebar-orange);
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--tables-text);
  line-height: 1.15;
`;

const ModalClose = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--orders-container-border);
  background: var(--tables-bg);
  color: var(--tables-text);
  cursor: pointer;
  font-size: 18px;
  flex-shrink: 0;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

const ModalForm = styled.form`
  display: grid;
`;

const ModalBody = styled.div`
  display: grid;
  gap: 14px;
  padding: 20px 22px;
`;

const ModalField = styled.div`
  display: grid;
  gap: 7px;

  label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }

  input {
    width: 100%;
    border: 1px solid var(--orders-container-border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--tables-text);
    padding: 11px 13px;
    font-size: 14px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:focus {
      border-color: color-mix(in srgb, var(--sidebar-orange) 55%, var(--orders-container-border));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sidebar-orange) 16%, transparent);
    }
  }
`;

const ModalHint = styled.span`
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.35;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px 18px;
  border-top: 1px solid var(--orders-container-border);
  background: color-mix(in srgb, var(--surface) 94%, var(--bg) 6%);
`;

export default Tables;
