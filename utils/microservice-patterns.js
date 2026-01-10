/**
 * Common patterns for .NET Core 8 Microservices
 */

export const microservicePatterns = {
    // Architectural Layers
    controller: /ControllerBase|Controller/g,
    repository: /Repository|IRepository/g,
    service: /Service|IService/g,
    dto: /Dto$|DTO$/g,

    // Microservice Communication
    httpClient: /HttpClient|IHttpClientFactory/g,
    messageQueue: /MassTransit|RabbitMQ|AzureServiceBus|Kafka/g,
    grpc: /Grpc/g,

    // Resilience
    polly: /Polly|Policy/g,
    retryComp: /Retry|CircuitBreaker/g,

    // Verification
    healthCheck: /MapHealthChecks|AddHealthChecks/g,
    logging: /ILogger|Serilog|NLog/g,

    // Configuration
    programCs: /Program\.cs$/,
    appSettings: /appsettings.*\.json$/,
};

export const antiPatterns = {
    // Architecture
    businessLogicInController: {
        pattern: /Controller/,
        indicator: /(var|const|int|string|bool)\s+\w+\s*=\s*.*;[\s\S]{100,}/g, // Heuristic: long controller methods
        message: "Controller methods should be thin. Move business logic to a Service layer."
    },
    directDbAccessInController: {
        pattern: /DbContext|DbSet/,
        context: /Controller/,
        message: "Controllers should not access DbContext directly. Use a Repository or Service."
    },

    // Error handling
    emptyCatch: /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g,
    genericCatch: /catch\s*\(\s*Exception\s+\w*\s*\)/g,

    // Performance / Async
    syncOverAsync: /\.Result|\.Wait\(\)/g,
    asyncVoid: /async\s+void\s+\w+/g,
};

// Memory Leak Patterns
export const memoryLeakPatterns = {
    eventSubscription: /\+=/g,
    eventUnsubscription: /-=/g,
    timerCreation: /new\s+Timer|new\s+System\.Timers\.Timer/g,
    cancellationToken: /CancellationToken/g,
    unmanagedResource: /IntPtr|HandleRef/g,
    staticFields: /static\s+(?!readonly)\w+\s+[\w<>]+\s+\w+\s*=/g, // static mutable fields
};
