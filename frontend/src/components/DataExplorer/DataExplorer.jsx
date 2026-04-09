import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Droplets,
  Gauge,
  MapPin,
  Search,
  SortAsc,
  SortDesc,
  Users,
} from "lucide-react";

const API_URL = "http://localhost:3001/api";

const sortOptions = [
  { value: "last_date", label: "Latest observation" },
  { value: "first_date", label: "First observation" },
  { value: "platform_number", label: "Float ID" },
  { value: "total_cycles", label: "Total cycles" },
  { value: "project_name", label: "Project" },
  { value: "data_centre", label: "Data centre" },
];

const getRowId = (row) => String(row?.platform_number ?? row?._id ?? "");

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

const getDateTimestamp = (value) => {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const getGeoLabel = (geo) => {
  if (!geo) return "Coordinates unavailable";
  const { min_lat, max_lat, min_lon, max_lon } = geo;
  const hasGeo = [min_lat, max_lat, min_lon, max_lon].every(
    (item) => item !== null && item !== undefined,
  );
  if (!hasGeo) return "Coordinates unavailable";
  return `Lat ${Number(min_lat).toFixed(1)}° – ${Number(max_lat).toFixed(1)}° · Lon ${Number(min_lon).toFixed(1)}° – ${Number(max_lon).toFixed(1)}°`;
};

const getSearchableText = (row) => {
  const parts = [
    getRowId(row),
    row.project_name,
    row.pi_name,
    row.platform_type,
    row.data_centre,
    row.total_cycles,
    row.has_bgc ? "bgc yes biogeochemical" : "bgc no core only",
    row.first_date,
    row.last_date,
    formatDate(row.first_date),
    formatDate(row.last_date),
    getGeoLabel(row.geo_bounding_box),
  ];
  return parts
    .filter((item) => item !== null && item !== undefined && item !== "")
    .join(" ")
    .toLowerCase();
};

const getSortValue = (row, field) => {
  switch (field) {
    case "first_date":
    case "last_date":
      return getDateTimestamp(row[field]);
    case "total_cycles":
      return Number(row.total_cycles ?? 0);
    case "platform_number":
      return String(row.platform_number ?? "");
    case "project_name":
    case "data_centre":
      return String(row[field] ?? "").toLowerCase();
    default:
      return String(row[field] ?? "").toLowerCase();
  }
};

/* ─── Stat card sub-component ─── */
const StatCard = ({ label, value, helper, icon: Icon, iconClass }) => (
  <div
    style={{
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: 16,
      padding: "20px 18px",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      minWidth: 0,
    }}
  >
    <div style={{ minWidth: 0, flex: 1 }}>
      <p style={{ fontSize: 13, fontWeight: 500, color: "#64748b", margin: 0 }}>
        {label}
      </p>
      <p
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: "#0f172a",
          margin: "4px 0 0",
          lineHeight: 1.2,
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: 11, color: "#94a3b8", margin: "6px 0 0" }}>
        {helper}
      </p>
    </div>
    <div
      className={iconClass}
      style={{
        borderRadius: 14,
        padding: 10,
        flexShrink: 0,
        border: "1px solid",
      }}
    >
      <Icon style={{ width: 20, height: 20 }} />
    </div>
  </div>
);

/* ─── Info cell inside a float card ─── */
const InfoCell = ({ icon: Icon, iconColor, label, children }) => (
  <div
    style={{
      background: "#f8fafc",
      borderRadius: 14,
      padding: "14px 16px",
      minWidth: 0,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 6,
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "#64748b",
      }}
    >
      <Icon style={{ width: 14, height: 14, color: iconColor, flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
    </div>
    <p
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: "#1e293b",
        margin: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
      }}
    >
      {children}
    </p>
  </div>
);

const DataExplorer = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [sortField, setSortField] = useState("last_date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [selectedRows, setSelectedRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const paginationOptions = [5, 10, 25, 50, 100, 200, 500, "All"];

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    setCurrentPage(1);
    try {
      const res = await axios.get(`${API_URL}/floats?limit=10000`);
      const floatDocs = res.data.floats || [];
      setData(floatDocs);
      setTotalRecords(res.data.count || floatDocs.length);
    } catch (err) {
      console.error("Failed to load data", err);
      setError(
        err.message ||
          "Failed to load float data. Make sure the backend server is running on port 3001.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredAndSortedData = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase();
    const filtered = normalizedSearch
      ? data.filter((row) => getSearchableText(row).includes(normalizedSearch))
      : [...data];
    filtered.sort((a, b) => {
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      const result = String(aVal).localeCompare(String(bVal), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDirection === "asc" ? result : -result;
    });
    return filtered;
  }, [data, deferredSearchTerm, sortDirection, sortField]);

  const actualItemsPerPage =
    itemsPerPage === "All" ? filteredAndSortedData.length : itemsPerPage;
  const totalPages =
    Math.ceil(filteredAndSortedData.length / actualItemsPerPage) || 1;

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * actualItemsPerPage;
  const endIndex = startIndex + actualItemsPerPage;
  const paginatedData = filteredAndSortedData.slice(startIndex, endIndex);

  const visibleIds = paginatedData.map(getRowId);
  const allVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedRows.includes(id));

  const selectedData = useMemo(
    () => data.filter((row) => selectedRows.includes(getRowId(row))),
    [data, selectedRows],
  );

  const bgcCount = useMemo(
    () => data.filter((row) => row.has_bgc).length,
    [data],
  );

  const handleSortDirectionToggle = () =>
    setSortDirection((c) => (c === "asc" ? "desc" : "asc"));

  const handleSelectRow = (id) =>
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );

  const handleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedRows((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setSelectedRows((prev) => [...new Set([...prev, ...visibleIds])]);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage((p) => p + 1);
  };
  const handlePrevious = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const handleExport = () => {
    const rowsToExport =
      selectedRows.length > 0 ? selectedData : filteredAndSortedData;
    if (rowsToExport.length === 0) return;
    const payload = {
      exported_at: new Date().toISOString(),
      export_scope: selectedRows.length > 0 ? "selected" : "filtered",
      total_records: rowsToExport.length,
      search_query: searchTerm.trim() || null,
      sort: { field: sortField, direction: sortDirection },
      floats: rowsToExport,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      selectedRows.length > 0
        ? "argo-floats-selected.json"
        : "argo-floats-filtered.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ── summary cards data ── */
  const summaryCards = [
    {
      label: "Total floats",
      value: totalRecords || data.length,
      helper: "Loaded from float summaries",
      icon: Database,
      iconClass: "bg-teal-50 text-teal-700 border-teal-100",
    },
    {
      label: "Visible results",
      value: filteredAndSortedData.length,
      helper: deferredSearchTerm
        ? "Matching your search"
        : "Current explorer view",
      icon: Search,
      iconClass: "bg-sky-50 text-sky-700 border-sky-100",
    },
    {
      label: "Selected",
      value: selectedRows.length,
      helper: "Ready for JSON export",
      icon: Download,
      iconClass: "bg-amber-50 text-amber-700 border-amber-100",
    },
    {
      label: "BGC enabled",
      value: bgcCount,
      helper: "Floats with biogeochemical sensors",
      icon: Droplets,
      iconClass: "bg-emerald-50 text-emerald-700 border-emerald-100",
    },
  ];

  /* ═══════════════════════════ RENDER ═══════════════════════════ */
  return (
    <div
      style={{
        width: "100%",
        background: "#ffffff",
        color: "#1e293b",
        position: "relative",
      }}
    >
      {/* ── background blobs (decorative) ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <motion.div
          style={{
            position: "absolute",
            right: -60,
            top: -40,
            width: 300,
            height: 300,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(20,184,166,0.08), rgba(14,165,233,0.03))",
          }}
          animate={{ y: [0, -14, 0], x: [0, 8, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          style={{
            position: "absolute",
            left: -40,
            bottom: -60,
            width: 260,
            height: 260,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(2,132,199,0.07), rgba(20,184,166,0.02))",
          }}
          animate={{ y: [0, 16, 0], x: [0, -10, 0] }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.6,
          }}
        />
      </div>

      {/* ── content wrapper ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1280,
          margin: "0 auto",
          padding: "32px 20px 48px",
        }}
      >
        {/* ── Error banner ── */}
        {error && (
          <div
            style={{
              marginBottom: 24,
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              borderRadius: 16,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              padding: "16px 20px",
              fontSize: 14,
              color: "#b91c1c",
            }}
          >
            <span style={{ fontSize: 16, marginTop: 2 }}>⚠</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, color: "#991b1b", margin: 0 }}>
                Unable to load data explorer
              </p>
              <p style={{ margin: "4px 0 0" }}>{error}</p>
            </div>
            <button
              type="button"
              onClick={fetchData}
              style={{
                borderRadius: 12,
                border: "1px solid #fecaca",
                background: "#fff",
                padding: "8px 14px",
                fontWeight: 500,
                color: "#b91c1c",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* ═══════ SECTION 1 — Header + Stats ═══════ */}
        <section
          style={{
            marginBottom: 24,
            borderRadius: 24,
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            padding: 28,
            boxShadow: "0 8px 32px rgba(15,23,42,0.04)",
          }}
        >
          {/* Title row */}
          <div style={{ marginBottom: 24 }}>
            <span
              style={{
                display: "inline-block",
                marginBottom: 12,
                borderRadius: 999,
                border: "1px solid #ccfbf1",
                background: "#f0fdfa",
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "#0f766e",
              }}
            >
              Float Metadata
            </span>
            <h1
              style={{
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: "-0.025em",
                color: "#0f172a",
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              Data Explorer
            </h1>
            <p
              style={{
                marginTop: 12,
                maxWidth: 640,
                fontSize: 15,
                lineHeight: 1.65,
                color: "#64748b",
              }}
            >
              Explore ARGO float summaries, search by float id or metadata, and
              export the current result set as JSON.
            </p>
          </div>

          {/* Stats grid — always 4 columns on desktop, 2 on mobile */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {summaryCards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>
        </section>

        {/* ═══════ SECTION 2 — Search + Sort + Export ═══════ */}
        <section
          style={{
            marginBottom: 24,
            borderRadius: 24,
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            padding: "24px 28px",
            boxShadow: "0 8px 32px rgba(15,23,42,0.03)",
          }}
        >
          {/* Row 1: Search */}
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="data-explorer-search"
              style={{
                display: "block",
                marginBottom: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "#475569",
              }}
            >
              Search floats
            </label>
            <div style={{ position: "relative" }}>
              <Search
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 18,
                  height: 18,
                  color: "#94a3b8",
                  pointerEvents: "none",
                }}
              />
              <input
                id="data-explorer-search"
                type="text"
                placeholder="Search by float id, project, PI, type, BGC, data centre, or date…"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 14,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  padding: "12px 14px 12px 42px",
                  fontSize: 14,
                  color: "#334155",
                  outline: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#2dd4bf";
                  e.target.style.boxShadow = "0 0 0 3px rgba(20,184,166,0.12)";
                  e.target.style.background = "#fff";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0";
                  e.target.style.boxShadow = "none";
                  e.target.style.background = "#f8fafc";
                }}
              />
            </div>
          </div>

          {/* Row 2: Sort + Buttons */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "flex-end",
            }}
          >
            {/* Sort field */}
            <div style={{ minWidth: 180, flex: "1 1 200px" }}>
              <label
                htmlFor="sort-field"
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#475569",
                }}
              >
                Sort by
              </label>
              <select
                id="sort-field"
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 14,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  padding: "12px 14px",
                  fontSize: 14,
                  color: "#334155",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Direction toggle */}
            <button
              type="button"
              onClick={handleSortDirectionToggle}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                padding: "12px 18px",
                fontSize: 14,
                fontWeight: 500,
                color: "#334155",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {sortDirection === "asc" ? (
                <SortAsc style={{ width: 16, height: 16 }} />
              ) : (
                <SortDesc style={{ width: 16, height: 16 }} />
              )}
              {sortDirection === "asc" ? "Ascending" : "Descending"}
            </button>

            {/* Export */}
            <button
              type="button"
              onClick={handleExport}
              disabled={
                isLoading ||
                (selectedRows.length === 0 &&
                  filteredAndSortedData.length === 0)
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 14,
                border: "none",
                background: "linear-gradient(135deg, #14b8a6, #0284c7)",
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 8px 20px rgba(20,184,166,0.22)",
                opacity:
                  isLoading ||
                  (selectedRows.length === 0 &&
                    filteredAndSortedData.length === 0)
                    ? 0.5
                    : 1,
              }}
            >
              <Download style={{ width: 16, height: 16 }} />
              Export JSON
            </button>
          </div>

          {/* Row 3: Selection status */}
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              fontSize: 13,
              color: "#64748b",
            }}
          >
            <p style={{ margin: 0 }}>
              {selectedRows.length > 0
                ? `${selectedRows.length} float${selectedRows.length === 1 ? "" : "s"} selected for export`
                : "No floats selected — export uses the current filtered results."}
            </p>
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={filteredAndSortedData.length === 0}
              style={{
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
                opacity: filteredAndSortedData.length === 0 ? 0.5 : 1,
              }}
            >
              {allVisibleSelected
                ? "Clear visible selection"
                : "Select visible floats"}
            </button>
          </div>
        </section>

        {/* ═══════ SECTION 3 — Float cards list ═══════ */}
        <section
          style={{
            borderRadius: 24,
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            padding: "24px 24px 28px",
            boxShadow: "0 8px 32px rgba(15,23,42,0.03)",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              paddingBottom: 16,
              marginBottom: 20,
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: 0,
                }}
              >
                Float results
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "#94a3b8",
                  margin: "4px 0 0",
                }}
              >
                Each float is shown as its own card with key metadata.
              </p>
            </div>
            <span
              style={{
                borderRadius: 999,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "#475569",
                whiteSpace: "nowrap",
              }}
            >
              Showing {paginatedData.length > 0 ? startIndex + 1 : 0} –{" "}
              {Math.min(endIndex, filteredAndSortedData.length)} of{" "}
              {totalRecords || data.length}
            </span>
          </div>

          {/* Body — loading / empty / cards */}
          {isLoading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                minHeight: 280,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "4px solid #e0f2fe",
                  borderTopColor: "#14b8a6",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <p style={{ fontSize: 14, fontWeight: 500, color: "#64748b" }}>
                Loading float summaries…
              </p>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : filteredAndSortedData.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 220,
                borderRadius: 20,
                border: "2px dashed #e2e8f0",
                background: "#f8fafc",
                textAlign: "center",
                padding: 32,
              }}
            >
              <p
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: "#334155",
                  margin: 0,
                }}
              >
                No floats match this search
              </p>
              <p
                style={{
                  marginTop: 8,
                  maxWidth: 400,
                  fontSize: 14,
                  color: "#94a3b8",
                }}
              >
                Try a float id, project name, PI name, platform type, date, or
                data centre.
              </p>
            </div>
          ) : (
            <>
              {/* Float cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {paginatedData.map((row) => {
                  const rowId = getRowId(row);
                  const isSelected = selectedRows.includes(rowId);
                  return (
                    <motion.article
                      key={rowId}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        borderRadius: 20,
                        border: `1px solid ${isSelected ? "#5eead4" : "#e2e8f0"}`,
                        background: isSelected
                          ? "rgba(240,253,250,0.5)"
                          : "#fff",
                        padding: "22px 24px",
                        transition: "border-color 0.2s, box-shadow 0.2s",
                        boxShadow: isSelected
                          ? "0 0 0 2px rgba(20,184,166,0.15)"
                          : "0 2px 8px rgba(15,23,42,0.03)",
                      }}
                    >
                      {/* Card top: ID + badges + select button */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          marginBottom: 16,
                        }}
                      >
                        {/* Left — ID + badges */}
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: 10,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              borderRadius: 999,
                              border: "1px solid #e0f2fe",
                              background: "#f0f9ff",
                              padding: "4px 12px",
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.15em",
                              color: "#0369a1",
                            }}
                          >
                            Float ID
                          </span>
                          <span
                            style={{
                              fontSize: 26,
                              fontWeight: 800,
                              letterSpacing: "-0.02em",
                              color: "#0f172a",
                            }}
                          >
                            {rowId}
                          </span>
                          <span
                            style={{
                              borderRadius: 999,
                              padding: "4px 12px",
                              fontSize: 11,
                              fontWeight: 600,
                              background: row.has_bgc ? "#d1fae5" : "#f1f5f9",
                              color: row.has_bgc ? "#065f46" : "#475569",
                            }}
                          >
                            {row.has_bgc ? "BGC enabled" : "Core float"}
                          </span>
                          <span
                            style={{
                              borderRadius: 999,
                              background: "#fffbeb",
                              padding: "4px 12px",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#92400e",
                            }}
                          >
                            {row.platform_type || "Type unavailable"}
                          </span>
                        </div>

                        {/* Right — Select button */}
                        <button
                          type="button"
                          onClick={() => handleSelectRow(rowId)}
                          style={{
                            borderRadius: 12,
                            border: `1px solid ${isSelected ? "#14b8a6" : "#e2e8f0"}`,
                            background: isSelected
                              ? "#14b8a6"
                              : "#fff",
                            color: isSelected ? "#fff" : "#475569",
                            padding: "10px 22px",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            transition: "all 0.2s",
                            boxShadow: isSelected
                              ? "0 6px 16px rgba(20,184,166,0.25)"
                              : "none",
                          }}
                        >
                          {isSelected ? "✓ Selected" : "Select float"}
                        </button>
                      </div>

                      {/* Card body: metadata grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(200px, 1fr))",
                          gap: 10,
                        }}
                      >
                        <InfoCell
                          icon={Database}
                          iconColor="#14b8a6"
                          label="Project"
                        >
                          {row.project_name || "—"}
                        </InfoCell>
                        <InfoCell
                          icon={Users}
                          iconColor="#0ea5e9"
                          label="Principal investigator"
                        >
                          {row.pi_name || "—"}
                        </InfoCell>
                        <InfoCell
                          icon={MapPin}
                          iconColor="#f43f5e"
                          label="Data centre"
                        >
                          {row.data_centre || "—"}
                        </InfoCell>
                        <InfoCell
                          icon={Gauge}
                          iconColor="#f59e0b"
                          label="Total cycles"
                        >
                          {row.total_cycles ?? "—"}
                        </InfoCell>
                        <InfoCell
                          icon={Calendar}
                          iconColor="#14b8a6"
                          label="Observation window"
                        >
                          {formatDate(row.first_date)} →{" "}
                          {formatDate(row.last_date)}
                        </InfoCell>
                        <InfoCell
                          icon={MapPin}
                          iconColor="#0ea5e9"
                          label="Bounding box"
                        >
                          {getGeoLabel(row.geo_bounding_box)}
                        </InfoCell>
                      </div>
                    </motion.article>
                  );
                })}
              </div>

              {/* Pagination */}
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 20,
                  borderTop: "1px solid #f1f5f9",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                {/* Left: per-page */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}
                  >
                    Floats per page:
                  </span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) =>
                      handleItemsPerPageChange(
                        e.target.value === "All"
                          ? "All"
                          : Number(e.target.value),
                      )
                    }
                    style={{
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                      padding: "8px 14px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#334155",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    {paginationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option === "All" ? "All floats" : option}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Right: page nav */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}
                  >
                    Page {currentPage} of {totalPages}
                  </span>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={handlePrevious}
                      disabled={currentPage === 1}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#334155",
                        cursor: currentPage === 1 ? "not-allowed" : "pointer",
                        opacity: currentPage === 1 ? 0.45 : 1,
                      }}
                    >
                      <ChevronLeft style={{ width: 16, height: 16 }} />
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={currentPage === totalPages}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#334155",
                        cursor:
                          currentPage === totalPages
                            ? "not-allowed"
                            : "pointer",
                        opacity: currentPage === totalPages ? 0.45 : 1,
                      }}
                    >
                      Next
                      <ChevronRight style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </motion.div>
    </div>
  );
};

export default DataExplorer;
