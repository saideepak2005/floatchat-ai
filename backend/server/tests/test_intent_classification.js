/**
 * Intent Classification Test
 * 
 * Tests the RAG intent classifier against all e2e_report.json queries.
 * Sends each prompt to the LLM intent classifier and verifies the correct tool is selected.
 * 
 * Usage: cd /home/cherry/Desktop/floatchat-ai/backend/server && node tests/test_intent_classification.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const MongoService = require('../services/mongoService');
const VectorService = require('../services/vectorService');
const McpService = require('../services/mcpService');
const RagService = require('../services/ragService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DATABASE_NAME || 'floatchat_ai';
const LLM_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'qwen/qwen3.5-397b-a17b';
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1';

// Tool name aliases — some e2e_report names map to our actual implementation names
const TOOL_ALIASES = {
  'visualize_float_trajectory': ['visualize_trajectory', 'trajectory_map'],
  'visualize_profile_depth_plot': ['visualize_depth_profile', 'plot_profiles', 'compare_profiles_depth'],
  'compare_profiles_depth': ['visualize_depth_profile', 'plot_profiles'],
  'map_marker_display': ['visualize_float_map', 'get_float_profiles'],
  'get_nearest_floats': ['nearest_floats'],
  'visualize_depth_histogram': ['visualize_depth_profile', 'get_data_table', 'get_dataset_metadata'],
  'visualize_float_density_map': ['visualize_float_map', 'visualize_heatmap'],
  'visualize_bgc_parameter_distribution': ['search_bgc_profiles', 'visualize_depth_profile', 'aggregate_statistics'],
  'visualize_heatmap_region': ['visualize_heatmap', 'generic_chat'],
  'visualize_section_plot': ['visualize_depth_profile', 'visualize_heatmap'],
  'visualize_parameter_scatter': ['visualize_ts_diagram'],
  'visualize_parameter_correlation': ['visualize_ts_diagram'],
  'auto_visualize': ['auto_visualize', 'visualize_depth_profile', 'visualize_ts_diagram', 'generic_chat'],
  'get_float_info': ['get_float_info', 'get_metadata_card', 'get_dataset_metadata'],
  'search_profiles': ['search_profiles', 'profiles_by_region'],
  'NONE': ['generic_chat'],
};

function isToolMatch(expected, actual) {
  // Direct match
  if (expected === actual) return true;
  
  // generic_chat for NONE
  if (expected === 'NONE' && actual === 'generic_chat') return true;
  
  // Check aliases
  const aliases = TOOL_ALIASES[expected];
  if (aliases && aliases.includes(actual)) return true;
  
  return false;
}

async function main() {
  console.log('='.repeat(60));
  console.log(' FloatChat-AI — Intent Classification Test');
  console.log('='.repeat(60));
  console.log(`LLM: ${LLM_MODEL}`);
  console.log(`API Key set: ${!!LLM_API_KEY && !LLM_API_KEY.includes('your-')}`);
  console.log();

  // Load e2e report
  const reportPath = path.resolve(__dirname, '../../../tests/e2e_report.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  const queries = report.e2e_rag_pipeline_tests.queries_prepared;

  // Initialize services
  const mongoService = new MongoService(MONGO_URI, DB_NAME);
  const vectorService = new VectorService();
  const mcpService = new McpService(mongoService);
  const ragService = new RagService(vectorService, mongoService, mcpService, {
    llmApiKey: LLM_API_KEY,
    llmModel: LLM_MODEL,
    llmBaseUrl: LLM_BASE_URL,
  });

  await mongoService.connect();
  // Don't wait for vector service — it's optional
  vectorService.connect().catch(() => {});

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const q of queries) {
    const start = Date.now();
    process.stdout.write(`[${q.id}/${queries.length}] "${q.query.substring(0, 60)}..." → `);
    
    try {
      const intent = await ragService._classifyIntent(q.query, []);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const match = isToolMatch(q.expected_tool, intent.tool);
      
      if (match) {
        passed++;
        console.log(`✅ ${intent.tool} (${elapsed}s)`);
      } else {
        failed++;
        console.log(`❌ got "${intent.tool}", expected "${q.expected_tool}" (${elapsed}s)`);
      }
      
      results.push({
        id: q.id,
        query: q.query,
        expected: q.expected_tool,
        actual: intent.tool,
        match,
        elapsed: +elapsed,
        category: q.category,
      });
    } catch (e) {
      failed++;
      console.log(`💥 ERROR: ${e.message}`);
      results.push({
        id: q.id,
        query: q.query,
        expected: q.expected_tool,
        actual: 'ERROR',
        match: false,
        error: e.message,
        category: q.category,
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(` RESULTS: ${passed}/${queries.length} PASSED, ${failed} FAILED`);
  console.log('='.repeat(60));
  
  // Category breakdown
  const categories = {};
  for (const r of results) {
    if (!categories[r.category]) categories[r.category] = { pass: 0, fail: 0 };
    if (r.match) categories[r.category].pass++;
    else categories[r.category].fail++;
  }
  console.log('\nCategory Breakdown:');
  for (const [cat, stats] of Object.entries(categories)) {
    const status = stats.fail === 0 ? '✅' : '⚠️';
    console.log(`  ${status} ${cat}: ${stats.pass}/${stats.pass + stats.fail}`);
  }

  // Failed queries
  const failures = results.filter(r => !r.match);
  if (failures.length > 0) {
    console.log('\nFailed Queries:');
    for (const f of failures) {
      console.log(`  [${f.id}] "${f.query}"`);
      console.log(`       Expected: ${f.expected} → Got: ${f.actual}`);
    }
  }

  await mongoService.close();
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
