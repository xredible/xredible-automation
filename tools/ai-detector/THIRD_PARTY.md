# Model and licence notes

The requested model is `desklib/ai-text-detector-v1.01`, revision
`5fdea974cd4287c61674951ec78803aa274e2fb7`. Its upstream model-card metadata
declares **MIT**. The model repository does not contain a separate LICENSE file;
the installer retains its README/model card alongside the downloaded weights.
MIT permits local/self-hosted use for a commercial parenting-blog workflow;
there is no per-call fee or required paid detection API. Retain upstream notices
when redistributing model data. This is the upstream declaration, not a claim
that a classifier’s output proves authorship.

- Model card and inference architecture:
  https://huggingface.co/desklib/ai-text-detector-v1.01/blob/5fdea974cd4287c61674951ec78803aa274e2fb7/README.md
- Checkpoint/config:
  https://huggingface.co/desklib/ai-text-detector-v1.01/tree/5fdea974cd4287c61674951ec78803aa274e2fb7
- Base model MIT declaration:
  https://huggingface.co/microsoft/deberta-v3-large
- Microsoft DeBERTa licence:
  https://github.com/microsoft/DeBERTa/blob/master/LICENSE

`model.py` implements the model card’s custom architecture (masked mean pooling
and a one-logit classifier). Loading a generic `AutoModelForSequenceClassification`
or a generic pipeline would not reliably load that trained classifier. No remote
Python code or pickle checkpoint is downloaded. CPU INT8 is a local optimisation
of these same weights and is identified in the response.

## Microsoft DeBERTa MIT notice

Copyright (c) Microsoft Corporation.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
