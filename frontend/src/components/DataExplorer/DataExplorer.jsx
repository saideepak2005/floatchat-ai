import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import {
  Search,
  Download,
  SortAsc,
  SortDesc,
  Eye,
  Database,
  Calendar,
  MapPin,
  Thermometer,
  Droplets,
  Gauge,
} from "lucide-react";

// API URL
const API_URL = "http://localhost:3001/api";

const DataExplorer = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [selectedFormat, setSelectedFormat] = useState("csv");
  const [selectedRows, setSelectedRows] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/floats?limit=250`);
      // floats endpoint returns { count, floats: [...] }
      const floatDocs = res.data.floats || [];
      setData(floatDocs);
      setTotalRecords(res.data.count || floatDocs.length);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const columns = [
    { key: "platform_number", label: "Platform #", icon: Database },
    { key: "first_date", label: "First Date", icon: Calendar },
    { key: "last_date", label: "Last Date", icon: Calendar },
    { key: "data_centre", label: "Data Centre", icon: MapPin },
    { key: "total_cycles", label: "Cycles", icon: Gauge },
    { key: "has_bgc", label: "Has BGC", icon: Droplets },
    { key: "project_name", label: "Project", icon: Thermometer },
    { key: "pi_name", label: "PI Name", icon: Eye },
    { key: "platform_type", label: "Float Type", icon: Database },
  ];

  const filteredAndSortedData = useMemo(() => {
    let filtered = data.filter((row) =>
      Object.values(row).some((value) =>
        value != null && String(value).toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    );

    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [data, searchTerm, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSelectRow = (id) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    if (selectedRows.length === filteredAndSortedData.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredAndSortedData.map((row) => row.platform_number));
    }
  };

  const handleExport = async () => {
    if (selectedFormat === "csv") {
      // If rows selected, export via server for real profile data
      if (selectedRows.length > 0) {
        try {
          const res = await axios.post(`${API_URL}/export/csv`, {
            profile_ids: selectedRows,
            params: ["PRES", "TEMP", "PSAL"],
          });
          const blob = new Blob([res.data], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "argo_data.csv";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error("Export failed", err);
        }
        return;
      }
      // Free export of float metadata from current view
      const headers = columns.map((c) => c.label).join(",");
      const rows = filteredAndSortedData.map((row) => {
        return columns
          .map((c) => {
            const v = row[c.key];
            if (v instanceof Date) return v.toISOString();
            if (v == null) return "";
            return String(v).replace(/,/g, ";");
          })
          .join(",");
      });
      const csvContent =
        "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "argo_floats_export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert("Only CSV export is supported. Select CSV format.");
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4 } },
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none z-0 fixed">
        <div className="absolute top-20 right-20 w-[30rem] h-[30rem] bg-cyan-100/40 rounded-full mix-blend-screen filter blur-[100px] animate-blob"></div>
        <div className="absolute bottom-20 left-20 w-[30rem] h-[30rem] bg-teal-100/30 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000"></div>
      </div>
      <motion.div
        className="max-w-7xl mx-auto p-4 lg:p-6 relative z-10"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-ocean-600 mb-2 drop-shadow-md">
              Data Matrix Explorer
            </h1>
            <p className="text-slate-600 font-mono tracking-wide">
              Browse, filter, and extract compiled metrics from the global ARGO
              grid
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-50 rounded-2xl p-6 mb-6 shadow-sm border border-slate-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-6">
            <div className="flex-1 max-w-xl">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-teal-600 group-hover:text-teal-700 transition-colors" />
                <input
                  type="text"
                  placeholder="Search stations, parameters, dates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all font-medium text-slate-800 placeholder-slate-500"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4 bg-white p-2 rounded-xl border border-slate-200">
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="px-4 py-2 border-none bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer"
              >
                <option value="csv">CSV Export</option>
                <option value="netcdf">NetCDF Export</option>
                <option value="parquet">Parquet Data</option>
                <option value="json">JSON API</option>
              </select>
              <button
                onClick={handleExport}
                className="flex items-center space-x-2 px-6 py-2 shadow-sm hover:shadow-md bg-teal-600 hover:bg-teal-700 text-white border-0 rounded-lg transition-all font-medium"
              >
                <Download className="w-4 h-4" />
                <span>Export Dataset</span>
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 flex flex-col">
          <div className="w-full overflow-x-auto">
            {isLoading ? (
              <div className="w-full h-96 flex flex-col items-center justify-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-teal-600"></div>
                <p className="text-slate-700 font-semibold animate-pulse">
                  Syncing ARGO telemetry node...
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-4 w-12">
                      <input
                        type="checkbox"
                        checked={
                          selectedRows.length ===
                            filteredAndSortedData.length &&
                          filteredAndSortedData.length > 0
                        }
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500 cursor-pointer"
                      />
                    </th>
                    {columns.map((column) => {
                      const Icon = column.icon;
                      return (
                        <th
                          key={column.key}
                          className="p-4 text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-200 transition-colors group whitespace-nowrap"
                          onClick={() => handleSort(column.key)}
                        >
                          <div className="flex items-center space-x-2">
                            <Icon className="w-4 h-4 text-slate-500 group-hover:text-teal-600 transition-colors" />
                            <span>{column.label}</span>
                            {sortField === column.key && (
                              <span className="text-white bg-teal-600 p-1 rounded">
                                {sortDirection === "asc" ? (
                                  <SortAsc className="w-3 h-3" />
                                ) : (
                                  <SortDesc className="w-3 h-3" />
                                )}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredAndSortedData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length + 1}
                        className="p-12 text-center text-slate-500 font-medium"
                      >
                        No measurements found matching your criteria.
                      </td>
                    </tr>
                  ) : null}
                  {filteredAndSortedData.map((row) => (
                    <motion.tr
                      key={row.platform_number || row._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`hover:bg-slate-50 transition-colors ${
                        selectedRows.includes(row.platform_number)
                          ? "bg-teal-50"
                          : ""
                      }`}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(row.platform_number)}
                          onChange={() => handleSelectRow(row.platform_number)}
                          className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500 cursor-pointer"
                        />
                      </td>
                      {columns.map((column) => (
                        <td key={column.key} className="p-4 text-sm">
                          {column.key === "platform_number" ? (
                            <span className="font-bold text-teal-700">
                              {row[column.key]}
                            </span>
                          ) : column.key === "first_date" ||
                            column.key === "last_date" ? (
                            <span className="text-slate-700">
                              {row[column.key]
                                ? new Date(row[column.key]).toLocaleDateString()
                                : "—"}
                            </span>
                          ) : column.key === "has_bgc" ? (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-bold ${
                                row[column.key]
                                  ? "text-green-700 bg-green-100"
                                  : "text-slate-500 bg-slate-100"
                              }`}
                            >
                              {row[column.key] ? "YES" : "NO"}
                            </span>
                          ) : (
                            <span className="text-slate-600">
                              {row[column.key] || "—"}
                            </span>
                          )}
                        </td>
                      ))}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-600">
              Showing{" "}
              <span className="text-slate-900 font-bold">
                {filteredAndSortedData.length}
              </span>{" "}
              records out of total network database
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DataExplorer;
