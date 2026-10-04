/** An error the API answers with on purpose: a status code and the message the client may show. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * The JSON body of an error response. It carries the same keys the Nuxt server used to send
 * (`error`, `statusCode`, `statusMessage`, `message`), which is what the clients in `@klndr/core`
 * read the message from.
 */
export const errorBody = (status: number, message: string) => ({
  error: true,
  statusCode: status,
  statusMessage: message,
  message,
});
