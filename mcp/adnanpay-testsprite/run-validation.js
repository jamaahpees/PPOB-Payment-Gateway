#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const BASE_URL = process.env.BASE_URL || 'https://demo.hanzserver.online/';
const TEST_DATA = {
  email: 'reseller@adnanpay.com',
  password: 'Reseller123!',
  admin_email: 'admin@adnanpay.com',
  admin_password: 'Admin123!@#',
  customer_id: '081234567890',
};

const flows = [
  { flow_type: 'guest_checkout', test_data: { customer_id: '081234567890' } },
  { flow_type: 'guest_tracking', test_data: {} },
  { flow_type: 'reseller_registration', test_data: {} },
  { flow_type: 'reseller_transaction', test_data: TEST_DATA },
  { flow_type: 'reseller_payout', test_data: TEST_DATA },
  { flow_type: 'admin_management', test_data: { admin_email: TEST_DATA.admin_email, admin_password: TEST_DATA.admin_password } },
];

const results = [];

async function runFlow(flow) {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['index.js'],
    cwd: 'D:\\coding\\1.PPOB PAYMENT\\mcp\\adnanpay-testsprite',
  });

  const client = new Client({
    name: 'testsprite-validator',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  await client.connect(transport);

  const response = await client.callTool({
    name: 'validate_user_flow',
    arguments: {
      flow_type: flow.flow_type,
      base_url: BASE_URL,
      test_data: flow.test_data,
    },
  });

  await client.close();
  return JSON.parse(response.content[0].text);
}

async function runAccessibilityAudit() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['index.js'],
    cwd: 'D:\\coding\\1.PPOB PAYMENT\\mcp\\adnanpay-testsprite',
  });

  const client = new Client({
    name: 'testsprite-validator',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  await client.connect(transport);

  const response = await client.callTool({
    name: 'accessibility_audit',
    arguments: { url: BASE_URL },
  });

  await client.close();
  return JSON.parse(response.content[0].text);
}

async function runPerformanceAudit() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['index.js'],
    cwd: 'D:\\coding\\1.PPOB PAYMENT\\mcp\\adnanpay-testsprite',
  });

  const client = new Client({
    name: 'testsprite-validator',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  await client.connect(transport);

  const response = await client.callTool({
    name: 'performance_audit',
    arguments: { url: BASE_URL },
  });

  await client.close();
  return JSON.parse(response.content[0].text);
}

async function main() {
  console.log('Running TestSprite Validation...');
  console.log('Target:', BASE_URL);
  console.log('---');

  for (const flow of flows) {
    console.log(`Running ${flow.flow_type}...`);
    try {
      const result = await runFlow(flow);
      results.push({ ...flow, ...result, status: result.success ? 'PASS' : 'FAIL' });
      console.log(`  -> ${result.success ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      results.push({ ...flow, status: 'ERROR', error: error.message });
      console.log(`  -> ERROR: ${error.message}`);
    }
  }

  console.log('\nRunning accessibility audit...');
  let accessibilityResult;
  try {
    accessibilityResult = await runAccessibilityAudit();
    results.push({ type: 'accessibility_audit', ...accessibilityResult, status: 'COMPLETED' });
  } catch (error) {
    results.push({ type: 'accessibility_audit', status: 'ERROR', error: error.message });
  }

  console.log('Running performance audit...');
  let performanceResult;
  try {
    performanceResult = await runPerformanceAudit();
    results.push({ type: 'performance_audit', ...performanceResult, status: 'COMPLETED' });
  } catch (error) {
    results.push({ type: 'performance_audit', status: 'ERROR', error: error.message });
  }

  console.log('\n--- Results ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);