'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  ArrowUpTrayIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface ParsedRow {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  city?: string;
  state?: string;
  country?: string;
  notes?: string;
  tags?: string[];
}

interface Job {
  id: string;
  title: string;
}

interface ImportResults {
  imported: number;
  skipped: number;
  errors: { row: number; email: string; error: string }[];
}

const REQUIRED_COLUMNS = ['firstName', 'lastName', 'email'];
const OPTIONAL_COLUMNS = ['phone', 'linkedinUrl', 'portfolioUrl', 'city', 'state', 'country', 'notes', 'tags'];
const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'importing' | 'complete'>('upload');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResults | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/jobs?status=open');
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const processFile = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setValidationErrors([]);

    const text = await uploadedFile.text();
    const lines = text.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      setValidationErrors(['File must contain at least a header row and one data row']);
      return;
    }

    // Parse CSV (simple parser, handles basic cases)
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]);
    const data = lines.slice(1).map((line) => parseCSVLine(line));

    setFileColumns(headers);
    setRawData(data);

    // Auto-map columns based on header names
    const autoMapping: Record<string, string> = {};
    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z]/g, '');

      ALL_COLUMNS.forEach((col) => {
        const normalizedCol = col.toLowerCase();
        if (
          normalizedHeader === normalizedCol ||
          normalizedHeader.includes(normalizedCol) ||
          (normalizedHeader === 'first' && col === 'firstName') ||
          (normalizedHeader === 'last' && col === 'lastName') ||
          (normalizedHeader === 'linkedin' && col === 'linkedinUrl') ||
          (normalizedHeader === 'portfolio' && col === 'portfolioUrl') ||
          (normalizedHeader === 'website' && col === 'portfolioUrl')
        ) {
          autoMapping[col] = index.toString();
        }
      });
    });

    setColumnMapping(autoMapping);
    setStep('map');
  };

  const handleColumnMap = (field: string, columnIndex: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [field]: columnIndex,
    }));
  };

  const validateAndPreview = () => {
    const errors: string[] = [];

    // Check required columns are mapped
    REQUIRED_COLUMNS.forEach((col) => {
      if (!columnMapping[col] && columnMapping[col] !== '0') {
        errors.push(`Required column "${col}" is not mapped`);
      }
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Parse data with mapping
    const parsed: ParsedRow[] = rawData.map((row) => {
      const candidate: ParsedRow = {
        firstName: row[parseInt(columnMapping.firstName)] || '',
        lastName: row[parseInt(columnMapping.lastName)] || '',
        email: row[parseInt(columnMapping.email)] || '',
      };

      OPTIONAL_COLUMNS.forEach((col) => {
        if (columnMapping[col]) {
          const value = row[parseInt(columnMapping[col])];
          if (col === 'tags' && value) {
            // Parse tags from pipe-separated string
            candidate.tags = value.split('|').map((t) => t.trim()).filter(Boolean);
          } else {
            (candidate as unknown as Record<string, string | undefined>)[col] =
              value || undefined;
          }
        }
      });

      return candidate;
    });

    // Validate email format
    const invalidEmails = parsed.filter(
      (c, i) => !c.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)
    );
    if (invalidEmails.length > 0) {
      errors.push(`${invalidEmails.length} rows have invalid or missing email addresses`);
    }

    const emptyNames = parsed.filter((c) => !c.firstName || !c.lastName);
    if (emptyNames.length > 0) {
      errors.push(`${emptyNames.length} rows have empty first or last names`);
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setParsedData(parsed);
    setValidationErrors([]);
    setStep('preview');
  };

  const handleImport = async () => {
    setImporting(true);
    setStep('importing');

    try {
      const response = await fetch('/api/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: parsedData,
          jobId: selectedJob || null,
          skipDuplicates,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
        setStep('complete');
      } else {
        const error = await response.json();
        setValidationErrors([error.error || 'Failed to import candidates']);
        setStep('preview');
      }
    } catch (error) {
      console.error('Error importing:', error);
      setValidationErrors(['Failed to import candidates. Please try again.']);
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setParsedData([]);
    setColumnMapping({});
    setFileColumns([]);
    setRawData([]);
    setStep('upload');
    setResults(null);
    setValidationErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    window.location.href = '/api/bulk-import/template';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Bulk Import</h1>
          <p className="text-sm text-gray-500 mt-1">
            Import prospects from a spreadsheet
          </p>
        </div>
        {step !== 'upload' && step !== 'complete' && (
          <Button variant="outline" onClick={resetImport}>
            Start Over
          </Button>
        )}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {['upload', 'map', 'preview', 'complete'].map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s
                  ? 'bg-brand-purple text-white'
                  : ['upload', 'map', 'preview', 'complete'].indexOf(step) > i
                  ? 'bg-success-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {['upload', 'map', 'preview', 'complete'].indexOf(step) > i ? (
                <CheckCircleIcon className="w-5 h-5" />
              ) : (
                i + 1
              )}
            </div>
            {i < 3 && (
              <div
                className={`w-12 h-0.5 mx-2 ${
                  ['upload', 'map', 'preview', 'complete'].indexOf(step) > i
                    ? 'bg-success-500'
                    : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <XCircleIcon className="w-5 h-5 text-danger-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-danger-800">Validation Errors</h4>
              <ul className="mt-2 text-sm text-danger-700 space-y-1">
                {validationErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <>
          <Card>
            <CardHeader title="Upload File" />
            <CardContent>
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-brand-purple transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <ArrowUpTrayIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                  Drag and drop your file here, or
                </p>
                <Button variant="outline" type="button">
                  Browse Files
                </Button>
                <p className="text-xs text-gray-400 mt-4">
                  Supports CSV (max 10MB)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Import Instructions" />
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-1 bg-success-100 rounded-full">
                    <CheckCircleIcon className="w-4 h-4 text-success-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Download the template
                    </p>
                    <p className="text-sm text-gray-500">
                      Use our template to ensure correct formatting
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-1 bg-success-100 rounded-full">
                    <CheckCircleIcon className="w-4 h-4 text-success-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Fill in candidate data
                    </p>
                    <p className="text-sm text-gray-500">
                      Required: First Name, Last Name, Email. Optional: Phone,
                      LinkedIn, Portfolio, City, State, Country, Notes, Tags
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-1 bg-success-100 rounded-full">
                    <CheckCircleIcon className="w-4 h-4 text-success-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Upload and review
                    </p>
                    <p className="text-sm text-gray-500">
                      Preview the import and map columns before confirming
                    </p>
                  </div>
                </div>
              </div>
              <Button variant="outline" className="mt-6" onClick={downloadTemplate}>
                <DocumentTextIcon className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step: Map Columns */}
      {step === 'map' && (
        <Card>
          <CardHeader
            title="Map Columns"
            subtitle={`Found ${rawData.length} rows in ${file?.name}`}
          />
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Match your file columns to candidate fields:
              </p>

              <div className="grid grid-cols-2 gap-4">
                {ALL_COLUMNS.map((field) => (
                  <div key={field} className="flex items-center gap-4">
                    <div className="w-1/2">
                      <label className="text-sm font-medium text-gray-700">
                        {field}
                        {REQUIRED_COLUMNS.includes(field) && (
                          <span className="text-danger-500 ml-1">*</span>
                        )}
                      </label>
                    </div>
                    <select
                      value={columnMapping[field] || ''}
                      onChange={(e) => handleColumnMap(field, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple text-sm"
                    >
                      <option value="">-- Select Column --</option>
                      {fileColumns.map((col, i) => (
                        <option key={i} value={i.toString()}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={resetImport}>
                  Cancel
                </Button>
                <Button onClick={validateAndPreview}>
                  Continue to Preview
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview */}
      {step === 'preview' && (
        <>
          <Card>
            <CardHeader title="Import Options" />
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Add to Job (Optional)
                  </label>
                  <select
                    value={selectedJob}
                    onChange={(e) => setSelectedJob(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                  >
                    <option value="">
                      Don&apos;t add to any job (prospects only)
                    </option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="w-4 h-4 text-brand-purple border-gray-300 rounded focus:ring-brand-purple"
                  />
                  <span className="text-sm text-gray-700">
                    Skip duplicate emails (candidates already in the system)
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Preview Data"
              subtitle={`${parsedData.length} candidates will be imported`}
            />
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">
                        #
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">
                        Location
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">
                        LinkedIn
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedData.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {row.firstName} {row.lastName}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{row.email}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {row.phone || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {[row.city, row.state, row.country].filter(Boolean).join(', ') || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {row.linkedinUrl ? '✓' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 10 && (
                  <div className="px-4 py-3 text-sm text-gray-500 bg-gray-50 border-t">
                    ...and {parsedData.length - 10} more rows
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setStep('map')}>
              Back to Mapping
            </Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${parsedData.length} Candidates`
              )}
            </Button>
          </div>
        </>
      )}

      {/* Step: Importing */}
      {step === 'importing' && (
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center">
              <ArrowPathIcon className="w-12 h-12 text-brand-purple animate-spin mb-4" />
              <h3 className="text-lg font-medium text-gray-900">
                Importing Candidates...
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Please wait while we process your file
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Complete */}
      {step === 'complete' && results && (
        <>
          <Card>
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircleIcon className="w-10 h-10 text-success-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">
                  Import Complete
                </h3>
                <div className="flex items-center gap-6 mt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success-600">
                      {results.imported}
                    </div>
                    <div className="text-sm text-gray-500">Imported</div>
                  </div>
                  {results.skipped > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {results.skipped}
                      </div>
                      <div className="text-sm text-gray-500">Skipped</div>
                    </div>
                  )}
                  {results.errors.length > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-danger-600">
                        {results.errors.length}
                      </div>
                      <div className="text-sm text-gray-500">Errors</div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {results.errors.length > 0 && (
            <Card>
              <CardHeader
                title="Import Errors"
                action={<Badge variant="error">{results.errors.length} errors</Badge>}
              />
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {results.errors.map((error, i) => (
                    <div key={i} className="flex items-center gap-3 p-4">
                      <ExclamationTriangleIcon className="w-5 h-5 text-danger-500" />
                      <div>
                        <span className="font-medium text-gray-900">
                          Row {error.row}:
                        </span>{' '}
                        <span className="text-gray-600">{error.email}</span>
                        <p className="text-sm text-danger-600">{error.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={resetImport}>
              Import More
            </Button>
            <Button onClick={() => (window.location.href = '/candidates')}>
              View Candidates
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
