// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System;

using Newtonsoft.Json;

using Xamarin.Interactive.CodeAnalysis.Evaluating;
using Xamarin.Interactive.Core;

namespace Xamarin.Interactive.Protocol
{
    [JsonObject]
    sealed class EvaluationAbortRequest : IXipRequestMessage<Agent>
    {
        public EvaluationContextId EvaluationContextId { get; }

        [JsonConstructor]
        public EvaluationAbortRequest (EvaluationContextId evaluationContextId)
            => EvaluationContextId = evaluationContextId;

        public void Handle (Agent agent, Action<object> responseWriter)
        {
            try {
                agent
                    .EvaluationContextManager
                    .AbortEvaluationAsync (EvaluationContextId)
                    .GetAwaiter ()
                    .GetResult ();
                responseWriter (true);
            } catch (Exception e) {
                responseWriter (new XipErrorMessage (e));
            }
        }
    }
}