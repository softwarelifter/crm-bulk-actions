import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

export const options = {
  scenarios: {
    smoke_test: {
      executor: "constant-vus",
      vus: 1,
      duration: "1m",
      tags: { test_type: "smoke" },
    },
    load_test: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 50 },
        { duration: "5m", target: 50 },
        { duration: "2m", target: 0 },
      ],
      tags: { test_type: "load" },
    },
    stress_test: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 50 },
        { duration: "3m", target: 100 },
        { duration: "1m", target: 0 },
      ],
      tags: { test_type: "stress" },
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.01"],
  },
};
const customMetrics = {
  successful_updates: new Rate("successful_updates"),
  failed_updates: new Rate("failed_updates"),
};

const payloadVariations = [
  {
    department: "Testing",
    company: "Acme Inc",
  },
  {
    department: "Engineering",
    company: "Acme Inc",
  },
  {
    department: "Marketing",
    company: "Acme Inc",
  },
];

export default function () {
  const variation =
    payloadVariations[Math.floor(Math.random() * payloadVariations.length)];

  const payload = JSON.stringify({
    actionType: "BULK_UPDATE",
    configuration: {
      updates: {
        metadata: {
          department: variation.department,
        },
      },
      filters: {
        "metadata.company": variation.company,
      },
    },
  });

  const headers = {
    Authorization:
      "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImFjY291bnRJZCI6MSwiaWF0IjoxNzMxOTIzNjg3LCJleHAiOjE3MzIwMTAwODd9.SN4-R51DQu5BQlhOflod73we6DHoWT1ZumMLT7C-Yao",
    "Content-Type": "application/json",
  };

  const response = http.post("http://localhost:3000/bulk-actions", payload, {
    headers: headers,
  });

  const checkResult = check(response, {
    "status is 201": (r) => r.status === 201,
    "response is valid": (r) => r.body.length > 0,
  });

  if (checkResult) {
    customMetrics.successful_updates.add(1);
  } else {
    customMetrics.failed_updates.add(1);
  }

  sleep(Math.random() * 2 + 1);
}
//sample test results
/**
 * ✓ status is 201
     ✓ response is valid

     checks.........................: 100.00% 40402 out of 40402
     data_received..................: 13 MB   23 kB/s
     data_sent......................: 9.5 MB  18 kB/s
     http_req_blocked...............: avg=10.11µs min=1µs    med=4µs    max=3.35ms   p(90)=13µs   p(95)=17µs  
     http_req_connecting............: avg=2.92µs  min=0s     med=0s     max=2.71ms   p(90)=0s     p(95)=0s    
   ✓ http_req_duration..............: avg=4.54ms  min=1.21ms med=3.56ms max=227.44ms p(90)=6.73ms p(95)=8.11ms
       { expected_response:true }...: avg=4.54ms  min=1.21ms med=3.56ms max=227.44ms p(90)=6.73ms p(95)=8.11ms
   ✓ http_req_failed................: 0.00%   0 out of 20201
     http_req_receiving.............: avg=51.02µs min=8µs    med=41µs   max=10.9ms   p(90)=89µs   p(95)=112µs 
     http_req_sending...............: avg=30.35µs min=4µs    med=21µs   max=4.79ms   p(90)=51µs   p(95)=65µs  
     http_req_tls_handshaking.......: avg=0s      min=0s     med=0s     max=0s       p(90)=0s     p(95)=0s    
     http_req_waiting...............: avg=4.46ms  min=1.19ms med=3.5ms  max=227.38ms p(90)=6.59ms p(95)=7.95ms
     http_reqs......................: 20201   37.370125/s
     iteration_duration.............: avg=2.01s   min=1s     med=2.01s  max=3.09s    p(90)=2.8s   p(95)=2.9s  
     iterations.....................: 20201   37.370125/s
     successful_updates.............: 100.00% 20201 out of 20201
     vus............................: 1       min=1              max=150
     vus_max........................: 150     min=150            max=150
 */
