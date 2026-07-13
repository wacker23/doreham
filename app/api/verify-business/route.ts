// Server-side API route for verifying business registration numbers
// with the Korean government's data.go.kr API.
// 
// This runs server-side so the API key stays secret.
// Add DATA_GO_KR_API_KEY to your environment variables.

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { brn } = await request.json();

    if (!brn || typeof brn !== 'string') {
      return NextResponse.json(
        { valid: false, reason: 'invalid_input' },
        { status: 400 }
      );
    }

    // Clean the BRN — just digits
    const cleanBrn = brn.replace(/[-\s]/g, '');

    if (!/^\d{10}$/.test(cleanBrn)) {
      return NextResponse.json(
        { valid: false, reason: 'not_10_digits' },
        { status: 400 }
      );
    }

    const apiKey = process.env.DATA_GO_KR_API_KEY;

    if (!apiKey) {
      console.error('DATA_GO_KR_API_KEY not set in environment');
      return NextResponse.json(
        { valid: false, reason: 'api_not_configured' },
        { status: 500 }
      );
    }

    // Call the National Tax Service API via data.go.kr
    // The API expects an array of business numbers to check
    const apiUrl = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        b_no: [cleanBrn],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('data.go.kr API error:', response.status, errorText);
      return NextResponse.json(
        { valid: false, reason: 'gov_api_error' },
        { status: 502 }
      );
    }

    const result = await response.json();

    // Expected response structure:
    // { data: [{ b_no, b_stt_cd, b_stt, tax_type, ... }], match_cnt, request_cnt, status_code }
    const businessInfo = result?.data?.[0];

    if (!businessInfo) {
      return NextResponse.json({
        valid: false,
        reason: 'not_found',
      });
    }

    // b_stt: business status
    //   "계속사업자" = active
    //   "휴업자" = temporarily closed
    //   "폐업자" = permanently closed
    //   "국세청에 등록되지 않은 사업자등록번호입니다." = not registered
    const status = businessInfo.b_stt;
    const statusCode = businessInfo.b_stt_cd;

    const isActive = status === '계속사업자' || statusCode === '01';
    const isNotRegistered = status?.includes('등록되지 않은') || statusCode === '';

    if (isNotRegistered) {
      return NextResponse.json({
        valid: false,
        reason: 'not_registered',
      });
    }

    return NextResponse.json({
      valid: isActive,
      status: status,
      statusCode: statusCode,
    });

  } catch (error) {
    console.error('Business verification error:', error);
    return NextResponse.json(
      { valid: false, reason: 'server_error' },
      { status: 500 }
    );
  }
}