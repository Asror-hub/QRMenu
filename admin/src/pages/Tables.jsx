import { useEffect, useState } from "react";
import styled from "styled-components";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../services/supabase";
import { useRestaurant } from "../context/RestaurantContext";

const Tables = () => {
  const { restaurant } = useRestaurant();
  const [tables, setTables] = useState([]);
  const [tableNumber, setTableNumber] = useState("");
  const [tableName, setTableName] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingTableId, setEditingTableId] = useState(null);
  const [editingTableName, setEditingTableName] = useState("");
  const [editingTableNumber, setEditingTableNumber] = useState("");

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

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!restaurant?.id) return;
    setLoading(true);
    await supabase.from("tables").insert({
      restaurant_id: restaurant.id,
      table_number: Number(tableNumber),
      table_name: tableName.trim() || null
    });
    setTableNumber("");
    setTableName("");
    setLoading(false);
    loadTables();
  };

  const handleDelete = async (id) => {
    await supabase.from("tables").delete().eq("id", id);
    loadTables();
  };

  const startEditing = (table) => {
    setEditingTableId(table.id);
    setEditingTableName(table.table_name ?? "");
    setEditingTableNumber(table.table_number ?? "");
  };

  const saveEditing = async (table) => {
    const nextNumber = Number(editingTableNumber);
    if (Number.isNaN(nextNumber)) {
      return;
    }
    await supabase
      .from("tables")
      .update({
        table_name: editingTableName.trim() || null,
        table_number: nextNumber
      })
      .eq("id", table.id);
    setEditingTableId(null);
    loadTables();
  };

  const baseUrl = import.meta.env.VITE_CUSTOMER_APP_URL || window.location.origin;
  const buildUrl = (tableId) => `${baseUrl}/r/${restaurant?.id}/t/${tableId}`;

  const handleDownload = (tableId, tableNumber) => {
    const canvas = document.getElementById(`qr-${tableId}`);
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `table-${tableNumber}-qr.png`;
    link.click();
  };

  return (
    <div>
      <HeaderRow>
        <div>
          <Heading>Tables</Heading>
          <Subheading>Create tables and print QR codes for each seat.</Subheading>
        </div>
        <FormCard>
          <Form onSubmit={handleCreate}>
            <Input
              type="number"
              value={tableNumber}
              onChange={(event) => setTableNumber(event.target.value)}
              placeholder="Table number"
              required
            />
            <Input
              type="text"
              value={tableName}
              onChange={(event) => setTableName(event.target.value)}
              placeholder="Table name (optional)"
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Table"}
            </Button>
          </Form>
        </FormCard>
      </HeaderRow>
      <List>
        {tables.map((table) => (
          <Row key={table.id}>
            <QRCard>
              <QRCodeCanvas
                id={`qr-${table.id}`}
                value={buildUrl(table.id)}
                size={120}
                includeMargin
              />
            </QRCard>
            <TableTitle>
              {editingTableId === table.id ? (
                <TableEditBlock>
                  <TableEditRow>
                    <TableNameInput
                      type="text"
                      value={editingTableName}
                      onChange={(event) => setEditingTableName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setEditingTableId(null);
                        }
                      }}
                      placeholder={table.table_name || "Table name"}
                      autoFocus
                    />
                    <TableNumberInput
                      type="number"
                      value={editingTableNumber}
                      onChange={(event) => setEditingTableNumber(event.target.value)}
                      placeholder={`${table.table_number}`}
                    />
                  </TableEditRow>
                  <TableEditActions>
                    <SecondaryButton type="button" onClick={() => setEditingTableId(null)}>
                      Cancel
                    </SecondaryButton>
                    <PrimaryButton type="button" onClick={() => saveEditing(table)}>
                      Save
                    </PrimaryButton>
                  </TableEditActions>
                </TableEditBlock>
              ) : table.table_name ? (
                `${table.table_name} ${table.table_number}`
              ) : (
                `Table ${table.table_number}`
              )}
            </TableTitle>
            <UrlText title={buildUrl(table.id)}>{buildUrl(table.id)}</UrlText>
            <Actions>
              <SecondaryButton
                type="button"
                onClick={() => handleDownload(table.id, table.table_number)}
              >
                Download QR
              </SecondaryButton>
              <IconButton
                type="button"
                aria-label="Edit table name"
                onClick={() => startEditing(table)}
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
                aria-label="Delete table"
                onClick={() => handleDelete(table.id)}
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
            </Actions>
          </Row>
        ))}
      </List>
    </div>
  );
};

const Heading = styled.h1`
  margin: 0 0 6px;
  font-size: 28px;
  font-weight: 600;
`;

const Subheading = styled.p`
  margin: 0 0 20px;
  color: var(--text-muted);
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
`;

const Form = styled.form`
  display: flex;
  gap: 12px;
`;

const Input = styled.input`
  min-width: 200px;
`;

const Button = styled.button`
  padding: 12px 16px;
  border-radius: 12px;
  background: linear-gradient(120deg, var(--primary), var(--primary-strong));
  color: #fff;
  cursor: pointer;
  box-shadow: 0 12px 24px rgba(79, 70, 229, 0.3);
`;

const PrimaryButton = styled.button`
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(99, 102, 241, 0.5);
  background: rgba(99, 102, 241, 0.2);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2);
`;

const List = styled.div`
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
`;

const Row = styled.div`
  background: linear-gradient(135deg, rgba(21, 31, 54, 0.95), rgba(17, 24, 39, 0.95));
  padding: 20px;
  border-radius: 20px;
  display: grid;
  grid-auto-rows: min-content;
  justify-items: center;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
  min-height: 320px;

  &::after {
    content: "";
    position: absolute;
    inset: auto -40px -60px auto;
    width: 140px;
    height: 140px;
    background: rgba(99, 102, 241, 0.16);
    filter: blur(28px);
    pointer-events: none;
  }
`;

const TableTitle = styled.span`
  font-weight: 600;
  font-size: 16px;
  text-align: center;
  z-index: 1;
  line-height: 1.3;
`;

const TableEditBlock = styled.div`
  display: grid;
  gap: 8px;
  width: 100%;
`;

const TableEditRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 80px;
  gap: 8px;
  align-items: center;
`;

const TableNameInput = styled.input`
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 8px;
  background: rgba(15, 23, 42, 0.6);
  color: var(--text);
  text-align: center;
  width: 100%;
`;

const TableNumberInput = styled.input`
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 8px;
  background: rgba(15, 23, 42, 0.6);
  color: var(--text);
  text-align: center;
  width: 100%;
`;

const TableEditActions = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
`;

const UrlText = styled.p`
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-all;
  text-align: center;
  z-index: 1;
  max-width: 200px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  white-space: nowrap;
  justify-content: center;
  z-index: 1;
`;

const IconButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(99, 102, 241, 0.4);
  background: rgba(15, 23, 42, 0.6);
  color: #fff;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;

  &:hover {
    background: rgba(99, 102, 241, 0.18);
    border-color: rgba(99, 102, 241, 0.6);
    transform: translateY(-1px);
  }
`;

const EditIcon = styled.svg`
  width: 16px;
  height: 16px;
  stroke: currentColor;
`;

const QRCard = styled.div`
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  padding: 12px;
  display: grid;
  place-items: center;
  z-index: 1;

  canvas {
    background: #fff;
    border-radius: 12px;
    padding: 8px;
  }
`;

const SecondaryButton = styled.button`
  border: 1px solid rgba(99, 102, 241, 0.4);
  background: rgba(99, 102, 241, 0.2);
  color: #fff;
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
`;

const DangerIconButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(239, 68, 68, 0.5);
  background: rgba(15, 23, 42, 0.6);
  color: #fff;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.18);
    border-color: rgba(239, 68, 68, 0.6);
    transform: translateY(-1px);
  }
`;

const TrashIcon = styled.svg`
  width: 16px;
  height: 16px;
  stroke: currentColor;
`;

const FormCard = styled.div`
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  padding: 14px;
  box-shadow: var(--shadow-sm);
`;

export default Tables;
