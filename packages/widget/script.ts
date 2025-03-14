const main = async () => {
  const res = await Promise.all([
    fetch("https://api.stakek.it/v1/yields/enabled/networks", {
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "en,fr;q=0.9,en-US;q=0.8,en-GB;q=0.7",
        "cache-control": "no-cache",
        pragma: "no-cache",
        priority: "u=1, i",
        "sec-ch-ua":
          '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "x-api-key": "e2d627cf-2ae3-4775-9fbc-76819c7cae38",
      },
      referrer: "http://localhost:5173/",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: null,
      method: "GET",
      mode: "cors",
      credentials: "omit",
    }),
    fetch("https://api.stakek.it/v1/tokens", {
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "en,fr;q=0.9,en-US;q=0.8,en-GB;q=0.7",
        "cache-control": "no-cache",
        pragma: "no-cache",
        priority: "u=1, i",
        "sec-ch-ua":
          '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "x-api-key": "e2d627cf-2ae3-4775-9fbc-76819c7cae38",
      },
      referrer: "http://localhost:5173/",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: null,
      method: "GET",
      mode: "cors",
      credentials: "omit",
    }),

    fetch("https://api.stakek.it/v1/tokens/balances/scan", {
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "en,fr;q=0.9,en-US;q=0.8,en-GB;q=0.7",
        "cache-control": "no-cache",
        "content-type": "application/json",
        pragma: "no-cache",
        priority: "u=1, i",
        "sec-ch-ua":
          '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "x-api-key": "e2d627cf-2ae3-4775-9fbc-76819c7cae38",
      },
      referrer: "http://localhost:5173/",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: '{"addresses":{"address":"0xdCeE0E27dd7c71f53AfC4E3A5248e286586B174d"},"network":"base"}',
      method: "POST",
      mode: "cors",
      credentials: "omit",
    }),

    fetch("https://api.stakek.it/v1/yields/balances/scan", {
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "en,fr;q=0.9,en-US;q=0.8,en-GB;q=0.7",
        "cache-control": "no-cache",
        "content-type": "application/json",
        pragma: "no-cache",
        priority: "u=1, i",
        "sec-ch-ua":
          '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "x-api-key": "e2d627cf-2ae3-4775-9fbc-76819c7cae38",
      },
      referrer: "http://localhost:5173/",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: '{"addresses":{"address":"0xdCeE0E27dd7c71f53AfC4E3A5248e286586B174d"},"network":"base","customValidators":[]}',
      method: "POST",
      mode: "cors",
      credentials: "omit",
    }),
  ]);

  const failing = res.filter((r) => !r.ok);

  for (const r of failing) {
    console.log(r);
    const json = await r.json();
    console.log(json);
  }
};

main();
