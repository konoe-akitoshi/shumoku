import { readFile } from 'node:fs/promises'
import { Client, credentials } from '@grpc/grpc-js'
import { Root } from 'protobufjs'
import descriptor from './hubble-proto.json' with { type: 'json' }

export const hubbleRoot = Root.fromJSON(descriptor)
const requestType = hubbleRoot.lookupType('observer.GetFlowsRequest')
const responseType = hubbleRoot.lookupType('observer.GetFlowsResponse')
export const hubbleMethod = {
  path: '/observer.Observer/GetFlows',
  requestStream: false,
  responseStream: true,
  requestSerialize: (value: object) =>
    Buffer.from(requestType.encode(requestType.fromObject(value)).finish()),
  requestDeserialize: (value: Buffer) =>
    requestType.toObject(requestType.decode(value), { longs: String }),
  responseSerialize: (value: object) =>
    Buffer.from(responseType.encode(responseType.fromObject(value)).finish()),
  responseDeserialize: (value: Buffer) =>
    responseType.toObject(responseType.decode(value), {
      longs: String,
      enums: String,
    }) as HubbleResponse,
}
export interface HubbleFlow {
  uuid?: string
  time?: { seconds?: string; nanos?: number }
  source?: { namespace?: string; pod_name?: string; cluster_name?: string }
  destination?: { namespace?: string; pod_name?: string; cluster_name?: string }
  IP?: { source?: string; destination?: string }
  l4?: {
    TCP?: { destination_port?: number }
    UDP?: { destination_port?: number }
    SCTP?: { destination_port?: number }
    ICMPv4?: object
    ICMPv6?: object
  }
  verdict?: string
  drop_reason_desc?: string
}
export interface HubbleResponse {
  flow?: HubbleFlow
  lost_events?: { num_events_lost?: string }
  node_status?: { state_change?: string; node_names?: string[] }
}
export interface HubbleSample {
  since: number
  until: number
  flows: HubbleFlow[]
  lostEvents: number
  unavailableNodes: number
  truncated: boolean
  error?: string
}
export interface HubbleOptions {
  address: string
  insecure: boolean
  caFile?: string
  certFile?: string
  keyFile?: string
  maxFlows: number
  timeoutMs: number
}
export function hubbleOptions(env: NodeJS.ProcessEnv = process.env): HubbleOptions {
  if (env['SHUMOKU_HUBBLE_ENABLED'] !== 'true')
    throw new Error('Hubble is disabled in the server deployment')
  const address = env['SHUMOKU_HUBBLE_ADDRESS'] ?? ''
  if (
    !/^[a-zA-Z0-9.-]+:\d{1,5}$/.test(address) ||
    Number(address.split(':')[1]) > 65535 ||
    Number(address.split(':')[1]) < 1
  )
    throw new Error('Invalid Hubble Relay host:port')
  const insecure = env['SHUMOKU_HUBBLE_INSECURE'] === 'true'
  const caFile = env['SHUMOKU_HUBBLE_CA_FILE']
  const certFile = env['SHUMOKU_HUBBLE_CERT_FILE']
  const keyFile = env['SHUMOKU_HUBBLE_KEY_FILE']
  if (!!certFile !== !!keyFile || (insecure && (caFile || certFile || keyFile)))
    throw new Error('Invalid Hubble TLS configuration')
  return { address, insecure, caFile, certFile, keyFile, maxFlows: 10000, timeoutMs: 10000 }
}
/** A bounded snapshot of Relay's recent ring buffers, not a durable traffic counter. */
export async function collectHubble(
  namespaces: string[],
  windowSeconds: number,
  options = hubbleOptions(),
  now = Date.now(),
): Promise<HubbleSample> {
  const sample: HubbleSample = {
    since: now - windowSeconds * 1000,
    until: now,
    flows: [],
    lostEvents: 0,
    unavailableNodes: 0,
    truncated: false,
  }
  const [ca, cert, key] = await Promise.all(
    [options.caFile, options.certFile, options.keyFile].map((file) =>
      file ? readFile(file) : undefined,
    ),
  )
  const client = new Client(
    options.address,
    options.insecure ? credentials.createInsecure() : credentials.createSsl(ca, key, cert),
    {
      'grpc.max_receive_message_length': 1024 * 1024,
      'grpc.enable_retries': 0,
    },
  )
  const timestamp = (ms: number) => ({
    seconds: String(Math.floor(ms / 1000)),
    nanos: (ms % 1000) * 1000000,
  })
  const whitelist = namespaces.flatMap((namespace) => [
    { source_pod: [`${namespace}/`] },
    { destination_pod: [`${namespace}/`] },
  ])
  try {
    return await new Promise<HubbleSample>((resolve, reject) => {
      const stream = client.makeServerStreamRequest(
        hubbleMethod.path,
        hubbleMethod.requestSerialize,
        hubbleMethod.responseDeserialize,
        {
          since: timestamp(sample.since),
          until: timestamp(sample.until),
          follow: false,
          whitelist,
          field_mask: {
            paths: [
              'uuid',
              'time',
              'source.namespace',
              'source.pod_name',
              'source.cluster_name',
              'destination.namespace',
              'destination.pod_name',
              'destination.cluster_name',
              'IP',
              'l4',
              'verdict',
              'drop_reason_desc',
            ],
          },
        },
        { deadline: now + options.timeoutMs },
      )
      const unavailable = new Set<string>()
      let messages = 0
      stream.on('data', (message: HubbleResponse) => {
        if (sample.truncated) return
        messages++
        if (message.flow) sample.flows.push(message.flow)
        if (message.lost_events)
          sample.lostEvents += Number(message.lost_events.num_events_lost ?? 0)
        if (message.node_status && message.node_status.state_change !== 'NODE_CONNECTED') {
          for (const name of message.node_status.node_names ?? ['unknown']) unavailable.add(name)
          sample.unavailableNodes = unavailable.size
        }
        if (sample.flows.length >= options.maxFlows || messages >= options.maxFlows * 2) {
          sample.truncated = true
          stream.cancel()
          resolve(sample)
        }
      })
      stream.on('end', () => resolve(sample))
      stream.on('error', () => {
        if (sample.truncated) resolve(sample)
        else
          reject(new Error('Hubble Relay query failed (connection, TLS, permission or deadline).'))
      })
    })
  } finally {
    client.close()
  }
}
